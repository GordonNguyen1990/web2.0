
import { supabase } from './supabaseClient';
import { User, UserRole } from '../types';

// Helper to race a promise against a timeout
const withTimeout = <T>(promise: PromiseLike<T>, ms: number, fallbackValue?: T): Promise<T> => {
    return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => 
            setTimeout(() => {
                if (fallbackValue !== undefined) {
                    // If fallback provided, resolve with it instead of rejecting
                    // But here we want to throw so the caller handles it or uses their own fallback
                    reject(new Error("Timeout")); 
                } else {
                    reject(new Error("Timeout"));
                }
            }, ms)
        )
    ]);
};

export const registerUser = async (email: string, password: string, fullName: string, referrerId?: string) => {
  // 1. Đăng ký user mới
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName, // Dữ liệu này sẽ được Trigger SQL dùng để tạo Profile
      },
    },
  });

  if (error) throw error;

  // 2. Nếu có người giới thiệu, cập nhật vào profile
  // Lưu ý: Trigger handle_new_user đã chạy ngay sau khi signUp. 
  // Chúng ta cần update thêm referrer_id vào bản ghi vừa tạo.
  if (data.user && referrerId) {
      try {
          // Timeout update referrer after 3s to avoid blocking UI
          const updatePromise = supabase
              .from('profiles')
              .update({ referrer_id: referrerId })
              .eq('id', data.user.id)
              .then(res => res); // Ensure promise type compatibility
          
          const { error: updateError } = await withTimeout(updatePromise, 3000);
          
          if (updateError) {
              console.error("Lỗi cập nhật người giới thiệu:", updateError);
          } else {
              console.log("Đã ghi nhận người giới thiệu:", referrerId);
          }
      } catch (err) {
          console.error("System error updating referrer:", err);
      }
  }

  return data;
};

export const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const loginWithGoogle = async () => {
    // Lấy URL hiện tại của trình duyệt để Google biết quay về đâu
    // Ví dụ: http://localhost:5173 hoặc https://web2-invest.netlify.app
    const currentOrigin = window.location.origin;

    console.log("Initiating Google Login with redirect to:", currentOrigin);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            // Quan trọng: RedirectTo phải khớp với "Authorized Redirect URIs" đã khai báo trong Google Console
            // Tuy nhiên, Supabase sẽ tự động xử lý việc này nếu bạn đã cấu hình Callback URL trong Supabase Dashboard
            redirectTo: currentOrigin, 
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    });
    
    if (error) {
        console.error("Google Login Error Detailed:", error);
        throw error;
    }
    
    return data;
};

export const logoutUser = async () => {
  // Use session storage cleanup first to ensure immediate effect
  localStorage.removeItem('sb-' + (import.meta.env.VITE_SUPABASE_URL ? new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0] : 'tiwbcztyyctoprpyskly') + '-auth-token');
  
  // Try to call server logout but don't block
  try {
      const { error } = await withTimeout(supabase.auth.signOut(), 2000);
      if (error) console.warn("Server logout warning:", error.message);
  } catch (e) {
      console.warn("Logout forced due to timeout/network error");
  }
};

// --- PASSWORD RESET FUNCTIONS ---

export const requestPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin, // Redirect về trang chủ sau khi click link
  });
  if (error) throw error;
};

export const updateUserPassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
  return data;
};

// -------------------------------

export const getCurrentUser = async (): Promise<User | null> => {
  try {
      // getSession tự động refresh token, nếu token lỗi nó sẽ trả về error hoặc session null
      // Add timeout 2s for session check
      const { data: { session }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(), 
          2000
      ).catch(() => ({ data: { session: null }, error: new Error("Session timeout") }));
      
      if (sessionError || !session) {
          // Bắt lỗi Invalid Refresh Token tại đây và trả về null để app coi như chưa login
          if (sessionError) {
              console.warn("Session Error (handled):", sessionError.message);
              // Nếu lỗi là do refresh token không hợp lệ (thường gặp), clear storage luôn
              if (sessionError.message.includes("refresh_token") || sessionError.message.includes("Failed to fetch")) {
                   localStorage.clear(); // Clear all
                   // Hoặc chỉ clear auth token cụ thể nếu muốn
              }
          }
          return null;
      }

      if (!session?.user) return null;

      // Lấy thêm thông tin chi tiết từ bảng profiles
      // Add timeout 3s for profile fetch
      try {
          const profilePromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()
                .then(res => res); // Normalize to Promise

          const { data: profile, error } = await withTimeout<any>(
            profilePromise,
            3000
          );

          if (error || !profile) {
            // Fallback nếu chưa có profile (vừa đăng ký xong có thể chưa kịp tạo)
            throw new Error("Profile not found or fetch error");
          }

          return {
            id: profile.id,
            email: profile.email,
            name: profile.full_name,
            role: profile.role as UserRole,
            balance: Number(profile.balance), // Supabase numeric trả về string, cần convert
            walletAddress: profile.wallet_address,
            joinedDate: profile.created_at,
            referrerId: profile.referrer_id,
            telegramUsername: profile.telegram_username,
            telegramChatId: profile.telegram_chat_id
          };
      } catch (profileErr) {
          // If profile fetch fails or timeouts, return basic user info from session
          console.warn("Profile fetch failed, using session fallback:", profileErr);
          return {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata.full_name || 'User',
            role: UserRole.USER,
            balance: 0,
            joinedDate: session.user.created_at,
          };
      }
  } catch (err) {
      console.warn("Unexpected Auth Error:", err);
      return null;
  }
};

export const getReferrals = async (userId: string): Promise<User[]> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('referrer_id', userId);

        if (error) {
            console.error("Error fetching referrals:", error);
            return [];
        }

        return data.map((profile: any) => ({
            id: profile.id,
            email: profile.email,
            name: profile.full_name,
            role: profile.role as UserRole,
            balance: Number(profile.balance),
            walletAddress: profile.wallet_address,
            joinedDate: profile.created_at,
            referrerId: profile.referrer_id
        }));
    } catch (err) {
        console.error("Exception fetching referrals:", err);
        return [];
    }
};

// --- MFA / 2FA FUNCTIONS ---

export const enrollMFA = async () => {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  });
  if (error) throw error;
  return data; // Contains id, type, totp: { qr_code, secret, uri }
};

export const verifyMFAEnrollment = async (factorId: string, code: string) => {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) throw error;
  return data;
};

export const unenrollMFA = async (factorId: string) => {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
};

// Hàm này cực kỳ quan trọng: Xóa TẤT CẢ các factor (dọn sạch rác) để tắt 2FA hoàn toàn
export const deleteAllMFAFactors = async () => {
  // 1. Lấy danh sách tất cả các factors
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;

  // 2. Lọc ra các factor kiểu TOTP (Authenticator)
  const totpFactors = data.all.filter(f => f.factor_type === 'totp');

  // 3. Xóa từng cái một
  const deletePromises = totpFactors.map(f => 
    supabase.auth.mfa.unenroll({ factorId: f.id })
  );

  await Promise.all(deletePromises);
};

export const getMFAStatus = async () => {
  try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return null;
      
      // Trả về factor TOTP bất kể trạng thái (verified hoặc unverified)
      // Điều này giúp UI biết là có factor tồn tại để hiển thị nút "Tắt" hoặc "Kích hoạt"
      const factor = data.all.find(f => f.factor_type === 'totp');
      return factor;
  } catch (e) {
      return null;
  }
};

export const checkMFAChallengeRequired = async () => {
  try {
      // Add timeout 2s
      const { data, error } = await withTimeout(
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          2000
      ).catch(() => ({ data: null, error: new Error("MFA check timeout") }));
      
      if (error || !data) return false;
      
      // currentLevel: AAL1 (Password only) vs nextLevel: AAL2 (Password + MFA)
      // If nextLevel is AAL2, it means user has MFA enabled and needs to verify.
      return data.nextLevel === 'aal2' && data.currentLevel === 'aal1';
  } catch (e) {
      return false;
  }
};

export const verifyMFALogin = async (code: string) => {
  // Lấy danh sách factors để tìm factorId
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactor = factors?.all.find(f => f.factor_type === 'totp');
  
  if (!totpFactor) throw new Error("Không tìm thấy cấu hình 2FA.");

  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: totpFactor.id,
    code,
  });
  if (error) throw error;
  return data;
};
