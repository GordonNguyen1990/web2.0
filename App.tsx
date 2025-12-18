
import React, { useState, useEffect, Suspense } from 'react';
import LandingPage from './components/LandingPage';
const Auth = React.lazy(() => import('./components/Auth'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const ChatWidget = React.lazy(() => import('./components/ChatWidget'));
import { User, UserRole, AppView, SystemConfig, Transaction } from './types';
import { sendWelcomeEmail, sendReferralNotification } from './services/emailService';
import { loginUser, registerUser, logoutUser, getCurrentUser, getReferrals, checkMFAChallengeRequired, verifyMFALogin, loginWithGoogle } from './services/authService';
import { supabase } from './services/supabaseClient';

const INITIAL_CONFIG: SystemConfig = {
  withdrawalFeePercent: 1.5,
  interestRatePercent: 5.0,
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [config, setConfig] = useState<SystemConfig>(INITIAL_CONFIG);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); 
  const [referrals, setReferrals] = useState<User[]>([]); 
  const [referrerId, setReferrerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false); // Global loading state for Auth actions

  // Định nghĩa hàm fetchReferrals ở cấp component để có thể gọi lại
  const handleFetchReferrals = async (userId: string) => {
      const refs = await getReferrals(userId);
      setReferrals(refs);
  };

  useEffect(() => {
    const initApp = async () => {
      // 1. Xử lý các tham số từ URL (Referral hoặc Error từ OAuth)
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref');
      const errorDesc = urlParams.get('error_description');
      const error = urlParams.get('error');
      
      // Nếu có lỗi từ Google/Supabase trả về
      if (error || errorDesc) {
          alert(`Lỗi Đăng Nhập: ${errorDesc?.replace(/\+/g, ' ') || error}\n\nVui lòng kiểm tra cấu hình Client Secret.`);
          window.history.replaceState({}, document.title, window.location.pathname);
          setView(AppView.LOGIN);
      }

      // Xử lý Link giới thiệu (Lưu vào localStorage để dùng sau này nếu reload)
      const path = window.location.pathname;
      let foundRef = refParam;
      
      if (!foundRef && path.startsWith('/ref/')) {
          foundRef = path.split('/ref/')[1];
      }

      if (foundRef) {
          setReferrerId(foundRef);
          localStorage.setItem('savedReferrerId', foundRef); // Sticky referral
          setView(AppView.REGISTER); 
      } else {
          // Thử khôi phục từ localStorage nếu không có trên URL
          const savedRef = localStorage.getItem('savedReferrerId');
          if (savedRef) {
              setReferrerId(savedRef);
          }
      }

      // 2. Load Session với cơ chế Timeout nhanh và không chặn UI
      
      try {
          // Tạo Timeout Promise: Nếu sau 1.5 giây không load được thì hủy chờ
          const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Connection timeout")), 1500)
          );

          // Đua tốc độ giữa việc lấy User và Timeout
          const user = await Promise.race([
              getCurrentUser(),
              timeoutPromise
          ]) as User | null;

          if (user) {
            setCurrentUser(user);
            // Nếu đang ở trang Landing/Login/Register mà phát hiện đã login -> Vào thẳng Dashboard
            setView((prevView) => {
                if (prevView === AppView.LOGIN || prevView === AppView.REGISTER || prevView === AppView.LANDING) {
                   return AppView.DASHBOARD;
                }
                return prevView; // Giữ nguyên nếu đang ở trang Reset Password hoặc MFA
            });
          }
      } catch (error) {
          console.warn("Session check skipped due to timeout or error:", error);
          // Không làm gì cả, mặc định sẽ là Landing Page
          // Giúp người dùng không bị kẹt ở màn hình Loading
      } finally {
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // console.log("Auth Event:", event);
      if (event === 'PASSWORD_RECOVERY') {
         setView(AppView.UPDATE_PASSWORD);
      } 
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
         // Chỉ load lại user nếu chưa có trong state để tránh re-render không cần thiết
         if (!currentUser && session?.user) {
             const user = await getCurrentUser();
             if (user) {
                 setCurrentUser(user);
                 setView(AppView.DASHBOARD);
             }
         }
      } else if (event === 'SIGNED_OUT') {
         setCurrentUser(null);
         setView(AppView.LANDING);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Remove currentUser dependency to avoid loops

  useEffect(() => {
      if (currentUser && view !== AppView.MFA_VERIFY && view !== AppView.UPDATE_PASSWORD) {
          handleFetchReferrals(currentUser.id);
          if (currentUser.role === UserRole.ADMIN) {
              fetchAllUsers();
          }
      }
  }, [currentUser, view]);

  const fetchAllUsers = async () => {
      const { data } = await supabase.from('profiles').select('*');
      if (data) {
          const mappedUsers = data.map((p: any) => ({
              id: p.id,
              email: p.email,
              name: p.full_name,
              role: p.role,
              balance: Number(p.balance),
              walletAddress: p.wallet_address,
              joinedDate: p.created_at,
          }));
          setAllUsers(mappedUsers);
      }
  };

  const handleAuthWithPassword = async (email: string, pass: string, name: string, isRegistering: boolean, refId?: string) => {
      setIsLoading(true);
      try {
          if (isRegistering) {
              const data = await registerUser(email, pass, name, refId || referrerId);
              
              sendWelcomeEmail(email, name).catch(console.error);
              if (refId || referrerId) {
                  const finalRefId = refId || referrerId;
                  if (finalRefId) {
                      sendReferralNotification(finalRefId, name).catch(console.error);
                  }
              }

              if (data.session) {
                  const user = await getCurrentUser();
                  if (user) {
                      setCurrentUser(user);
                      setView(AppView.DASHBOARD);
                  }
              } else {
                  alert("Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.");
                  setView(AppView.LOGIN);
              }
          } else {
              const { user: authUser } = await loginUser(email, pass);
              
              const needsMfa = await checkMFAChallengeRequired();
              
              if (needsMfa) {
                  setView(AppView.MFA_VERIFY);
              } else {
                  let user = await getCurrentUser();
                  
                  // Fallback: Nếu getCurrentUser thất bại (do mạng/session lag), dùng thông tin từ authUser
                  if (!user && authUser) {
                      user = {
                          id: authUser.id,
                          email: authUser.email || '',
                          name: authUser.user_metadata?.full_name || 'User',
                          role: UserRole.USER,
                          balance: 0, // Tạm thời 0, sẽ fetch lại sau
                          joinedDate: authUser.created_at,
                      };
                  }

                  if (user) {
                    setCurrentUser(user);
                    setView(AppView.DASHBOARD);
                  } else {
                      throw new Error("Không thể tải thông tin người dùng. Vui lòng thử lại.");
                  }
              }
          }
      } catch (error: any) {
          console.error(error);
          let msg = error.message;
          if (msg.includes("Email not confirmed")) {
              msg = "Email chưa được xác thực. Vui lòng kiểm tra hộp thư đến (và Spam) để kích hoạt tài khoản.";
          } else if (msg.includes("Invalid login credentials")) {
              msg = "Sai email hoặc mật khẩu.";
          }
          alert("Thất bại: " + msg);
      } finally {
          setIsLoading(false);
      }
  };

  const handleGoogleAuth = async () => {
      setIsLoading(true);
      try {
          await loginWithGoogle();
      } catch (error: any) {
          alert("Lỗi đăng nhập Google: " + (error.message || "Không xác định"));
          setIsLoading(false);
      }
  };

  const handleMfaVerifySubmit = async (code: string) => {
      setIsLoading(true);
      try {
        const { user: authUser } = await verifyMFALogin(code);
        let user = await getCurrentUser();

        if (!user && authUser) {
             user = {
                id: authUser.id,
                email: authUser.email || '',
                name: authUser.user_metadata?.full_name || 'User',
                role: UserRole.USER,
                balance: 0,
                joinedDate: authUser.created_at,
             };
        }

        if (user) {
            setCurrentUser(user);
            setView(AppView.DASHBOARD);
        } else {
             throw new Error("Không thể tải hồ sơ người dùng.");
        }
      } catch (error: any) {
        alert("Xác thực MFA thất bại: " + error.message);
      } finally {
        setIsLoading(false);
      }
  };

  const handleLogout = async () => {
    try {
        await logoutUser();
        // Clear local storage tab state on logout
        localStorage.removeItem('activeTab');
    } catch (e) {
        console.error("Logout error", e);
    }
    setCurrentUser(null);
    setView(AppView.LANDING);
  };

  const handleTransaction = async (type: 'DEPOSIT' | 'WITHDRAW', amount: number, skipDbUpdate?: boolean) => {
    if (!currentUser) return;
    
    const newTx: Transaction = {
        id: Date.now().toString(),
        type,
        amount,
        date: new Date().toISOString(),
        status: 'COMPLETED',
    };
    setTransactions([newTx, ...transactions]);

    let newBalance = currentUser.balance;
    if (type === 'DEPOSIT') newBalance += amount;
    else if (type === 'WITHDRAW') newBalance -= amount;

    const updatedUser = { ...currentUser, balance: newBalance };
    setCurrentUser(updatedUser);

    if (!skipDbUpdate) {
        try {
            await supabase.from('profiles').update({ balance: newBalance }).eq('id', currentUser.id);
        } catch (error) {
            console.error("Error syncing balance:", error);
        }
    }
  };

  const handleUserUpdate = async (updatedUser: User) => {
      setCurrentUser(updatedUser);
      try {
          if (updatedUser.walletAddress) {
              await supabase.from('profiles').update({ wallet_address: updatedUser.walletAddress }).eq('id', updatedUser.id);
          } else {
              await supabase.from('profiles').update({ wallet_address: null }).eq('id', updatedUser.id);
          }
      } catch (error) {
          console.error("Error updating user profile:", error);
      }
  };

  const handleConfigUpdate = (newConfig: SystemConfig) => {
      setConfig(newConfig);
  };

  // Wrapper function to trigger refresh from Dashboard
  const handleManualRefreshReferrals = async () => {
      if (currentUser) {
          await handleFetchReferrals(currentUser.id);
      }
  };

  // Luôn render UI, session check diễn ra ngầm để tránh chờ lâu

  return (
    <>
      {view === AppView.LANDING && (
        <LandingPage onNavigate={setView} />
      )}

      {(view === AppView.LOGIN || view === AppView.REGISTER || view === AppView.FORGOT_PASSWORD || view === AppView.UPDATE_PASSWORD || view === AppView.MFA_VERIFY) && (
        <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center text-brand-400">Đang tải...</div>}>
          <Auth 
            view={view} 
            onSwitchView={setView} 
            onAuthenticate={() => {}}
            onAuthSubmit={handleAuthWithPassword}
            onMfaVerify={handleMfaVerifySubmit}
            onGoogleLogin={handleGoogleAuth}
            referrerId={referrerId}
            isLoading={isLoading}
          />
        </Suspense>
      )}

      {view === AppView.DASHBOARD && currentUser && (
        <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center text-brand-400">Đang tải Dashboard...</div>}>
          <Dashboard 
            user={currentUser} 
            config={config} 
            onLogout={handleLogout}
            onTransaction={handleTransaction}
            onUserUpdate={handleUserUpdate}
            onNavigateToAdmin={() => setView(AppView.ADMIN_PANEL)}
            transactions={transactions}
            referrals={referrals}
            onRefreshReferrals={handleManualRefreshReferrals}
          />
        </Suspense>
      )}

      {view === AppView.ADMIN_PANEL && currentUser && (
        <Suspense fallback={<div className="min-h-[200px] flex items-center justify-center text-brand-400">Đang tải Admin...</div>}>
          <AdminPanel 
            config={config} 
            users={allUsers}
            onUpdateConfig={handleConfigUpdate}
            onLogout={handleLogout}
            onNavigateToDashboard={() => setView(AppView.DASHBOARD)}
          />
        </Suspense>
      )}
      
      {/* Global AI Support Widget */}
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </>
  );
};

export default App;
