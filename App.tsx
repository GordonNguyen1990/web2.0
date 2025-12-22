
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
import { getSystemConfig, updateSystemConfig } from './services/configService';

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
  const [isSessionLoading, setIsSessionLoading] = useState(true); // Initial session check

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

      // 2. Load Session
      
      try {
          // Fetch System Config concurrently
          getSystemConfig().then(remoteConfig => {
              if (remoteConfig) setConfig(remoteConfig);
          });

          // OPTIMIZATION 1: Check LocalStorage for Supabase token first
          // If no token exists, we can skip the expensive network check and render Landing immediately.
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tiwbcztyyctoprpyskly.supabase.co';
          let projectId = 'tiwbcztyyctoprpyskly';
          try {
             projectId = new URL(supabaseUrl).hostname.split('.')[0];
          } catch (e) { /* ignore invalid url */ }
          
          const storageKey = `sb-${projectId}-auth-token`;
          const hasToken = localStorage.getItem(storageKey);

          if (!hasToken) {
              // No token -> Not logged in -> Stop loading
              setIsSessionLoading(false);
              return;
          }

          // OPTIMIZATION 2: Optimistic UI with Cached User
          // Try to load user from local storage to show Dashboard IMMEDIATELY while fetching fresh data
          const cachedUserStr = localStorage.getItem('cachedUser');
          if (cachedUserStr) {
              try {
                  const cachedUser = JSON.parse(cachedUserStr);
                  setCurrentUser(cachedUser);
                  setView(AppView.DASHBOARD);
                  setIsSessionLoading(false); // Stop spinner immediately
              } catch (e) {
                  console.warn("Invalid cached user");
              }
          }

          // Wait for user session (Background fetch if cached user exists)
          const user = await getCurrentUser();

          if (user) {
            setCurrentUser(user);
            // Save to cache for next time
            localStorage.setItem('cachedUser', JSON.stringify(user));
            
            // Nếu đang ở trang Landing/Login/Register mà phát hiện đã login -> Vào thẳng Dashboard
            setView((prevView) => {
                if (prevView === AppView.LOGIN || prevView === AppView.REGISTER || prevView === AppView.LANDING) {
                   return AppView.DASHBOARD;
                }
                return prevView; // Giữ nguyên nếu đang ở trang Reset Password hoặc MFA
            });
          } else {
             // If token existed but session is invalid/expired
             if (cachedUserStr) {
                 // We showed dashboard optimistically, but session is dead.
                 // Revert to Landing and clear cache
                 setCurrentUser(null);
                 setView(AppView.LANDING);
                 localStorage.removeItem('cachedUser');
             }
          }
      } catch (error) {
          console.warn("Session check error:", error);
      } finally {
          setIsSessionLoading(false);
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
                      localStorage.setItem('cachedUser', JSON.stringify(user));
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
                    localStorage.setItem('cachedUser', JSON.stringify(user));
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
            localStorage.setItem('cachedUser', JSON.stringify(user));
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
        localStorage.removeItem('cachedUser');
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
    localStorage.setItem('cachedUser', JSON.stringify(updatedUser));

    if (!skipDbUpdate) {
        try {
            await supabase.from('profiles').update({ balance: newBalance }).eq('id', currentUser.id);
            
            // Insert transaction to trigger Webhook Notification
            const { data: txData } = await supabase.from('transactions').insert({
                user_id: currentUser.id,
                type: type,
                amount: amount,
                status: 'COMPLETED',
                date: new Date().toISOString(),
                description: type === 'DEPOSIT' ? 'Nạp tiền thủ công' : 'Rút tiền'
            }).select().single();

            // DIRECT CALL TO NOTIFY (BACKUP FOR WEBHOOK)
            if (txData) {
                fetch('/.netlify/functions/notify_transaction', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        record: txData,
                        type: 'INSERT' // Simulate Insert Payload
                    })
                }).catch(err => console.error("Direct notify failed", err));
            }

        } catch (error) {
            console.error("Error syncing balance:", error);
        }
    }
  };

  const handleUserUpdate = async (updatedUser: User) => {
      setCurrentUser(updatedUser);
      localStorage.setItem('cachedUser', JSON.stringify(updatedUser));
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

  const handleConfigUpdate = async (newConfig: SystemConfig) => {
      setConfig(newConfig);
      await updateSystemConfig(newConfig);
  };

  // Wrapper function to trigger refresh from Dashboard
  const handleManualRefreshReferrals = async () => {
      if (currentUser) {
          await handleFetchReferrals(currentUser.id);
      }
  };

  // Luôn render UI, session check diễn ra ngầm để tránh chờ lâu

  if (isSessionLoading) {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400 font-medium">Đang khởi động...</p>
            </div>
        </div>
    );
  }

  return (
    <>
      {view === AppView.LANDING && (
        <LandingPage onLoginClick={() => setView(AppView.LOGIN)} />
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
