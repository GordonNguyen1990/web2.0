
import React, { useState } from 'react';
import { AppView } from '../types';
import { GoogleIcon, HomeIcon } from './Icons';
import { requestPasswordReset, updateUserPassword } from '../services/authService';

interface AuthProps {
  view: AppView;
  onSwitchView: (view: AppView) => void;
  onAuthenticate: (email: string, name: string, isRegistering: boolean) => void;
  onAuthSubmit?: (email: string, pass: string, name: string, isRegistering: boolean, referrerId?: string) => void;
  onMfaVerify?: (code: string) => void;
  onGoogleLogin?: () => void;
  referrerId?: string;
  isLoading?: boolean;
}

const LoadingSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const Auth: React.FC<AuthProps> = ({ view, onSwitchView, onAuthSubmit, onMfaVerify, onGoogleLogin, referrerId, isLoading = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [resetSent, setResetSent] = useState(false); 

  const isRegister = view === AppView.REGISTER;
  const isLogin = view === AppView.LOGIN;
  const isMfa = view === AppView.MFA_VERIFY;
  const isForgotPassword = view === AppView.FORGOT_PASSWORD;
  const isUpdatePassword = view === AppView.UPDATE_PASSWORD;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    // Xử lý MFA
    if (isMfa && onMfaVerify) {
        onMfaVerify(mfaCode);
        return;
    }

    // Xử lý Quên mật khẩu
    if (isForgotPassword) {
      if (!email) {
        alert("Vui lòng nhập email.");
        return;
      }
      try {
        await requestPasswordReset(email);
        setResetSent(true);
      } catch (error: any) {
        alert("Lỗi: " + error.message);
      }
      return;
    }

    // Xử lý Cập nhật mật khẩu mới
    if (isUpdatePassword) {
      if (!password || password !== confirmPassword) {
        alert("Mật khẩu không khớp hoặc bị trống.");
        return;
      }
      try {
        await updateUserPassword(password);
        alert("Đổi mật khẩu thành công! Bạn sẽ được chuyển đến Dashboard.");
        window.location.href = "/";
      } catch (error: any) {
        alert("Lỗi cập nhật mật khẩu: " + error.message);
      }
      return;
    }

    // Xử lý Đăng ký / Đăng nhập
    if (!email || !password || (isRegister && !name)) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }
    
    if (onAuthSubmit) {
        onAuthSubmit(email, password, name || email.split('@')[0], isRegister, referrerId);
    }
  };

  // --- VIEW: MFA INPUT ---
  if (isMfa) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative">
             {/* Background Ambience */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[100px] animate-pulse"></div>
            <div className="w-full max-w-md p-10 bg-dark-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative z-10">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">Xác Thực 2 Lớp</h1>
                    <p className="text-gray-400 text-sm font-medium">Nhập mã OTP từ ứng dụng Authenticator</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div>
                        <input
                            type="text"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            className="w-full h-16 bg-dark-950/80 border border-gray-700 rounded-2xl px-4 text-white text-center text-4xl font-mono tracking-[0.5em] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all placeholder-gray-800"
                            placeholder="000000"
                            maxLength={6}
                            autoFocus
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || mfaCode.length < 6}
                        className={`w-full h-14 flex items-center justify-center font-bold rounded-xl shadow-xl transition-all text-sm uppercase tracking-wider ${
                            isLoading 
                            ? 'bg-gray-800 cursor-not-allowed text-gray-400' 
                            : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white transform active:scale-[0.98]'
                        }`}
                    >
                        {isLoading ? <><LoadingSpinner /> Đang xác thực...</> : 'Xác nhận'}
                    </button>
                    <button
                        type="button"
                        onClick={() => !isLoading && onSwitchView(AppView.LOGIN)}
                        className="w-full text-sm font-medium text-gray-500 hover:text-white transition-colors"
                        disabled={isLoading}
                    >
                        &larr; Quay lại đăng nhập
                    </button>
                </form>
            </div>
        </div>
      );
  }

  // --- VIEW: DEFAULT LOGIN / REGISTER / FORGOT / UPDATE ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden p-4 sm:p-6 font-sans">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      <div className="w-full max-w-[440px] bg-dark-900/60 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-2xl z-10 flex flex-col">
        {/* Header Section */}
        <div className="px-8 sm:px-10 pt-12 pb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
             Web2<span className="text-brand-500">Invest</span>
          </h1>
          <p className="text-gray-400 text-base font-medium leading-relaxed">
            {isRegister ? 'Khởi tạo danh mục đầu tư chuyên nghiệp' : 
             isForgotPassword ? 'Khôi phục quyền truy cập' :
             isUpdatePassword ? 'Thiết lập mật khẩu mới' :
             'Chào mừng trở lại!'}
          </p>
          {isRegister && referrerId && (
              <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
                  <span className="text-xs font-semibold text-brand-300">
                      Sponsor ID: {referrerId.slice(0, 6)}...
                  </span>
              </div>
          )}
        </div>

        {/* Form Section */}
        <div className="px-8 sm:px-10 pb-10 flex-1">
            {isForgotPassword && resetSent ? (
            <div className="text-center space-y-6 animate-fadeIn py-4">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-green-500/20">
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </div>
                <div className="space-y-3">
                    <h3 className="text-white font-bold text-xl">Đã gửi email!</h3>
                    <p className="text-gray-400 text-base leading-relaxed">
                        Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra cả hộp thư Spam.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onSwitchView(AppView.LOGIN)}
                    className="w-full py-4 bg-dark-800 text-white font-bold rounded-xl hover:bg-dark-700 transition-colors text-sm uppercase tracking-wide border border-white/10 mt-4"
                >
                    Quay lại Đăng nhập
                </button>
            </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
                {isRegister && (
                <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500 ml-1">Họ và Tên</label>
                    <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-14 bg-dark-950/60 border border-gray-800 rounded-xl px-5 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:opacity-50 placeholder-gray-600 text-base font-medium"
                    placeholder="Nhập tên hiển thị"
                    disabled={isLoading}
                    />
                </div>
                )}
                
                {!isUpdatePassword && (
                    <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500 ml-1">Địa chỉ Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-14 bg-dark-950/60 border border-gray-800 rounded-xl px-5 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:opacity-50 placeholder-gray-600 text-base font-medium"
                        placeholder="name@example.com"
                        disabled={isLoading}
                    />
                    </div>
                )}

                {(!isForgotPassword) && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500 ml-1">
                                {isUpdatePassword ? 'Mật khẩu mới' : 'Mật khẩu'}
                            </label>
                            {isLogin && (
                                <button 
                                    type="button"
                                    onClick={() => onSwitchView(AppView.FORGOT_PASSWORD)}
                                    className="text-xs text-brand-500 hover:text-brand-400 font-bold transition-colors"
                                >
                                    Quên mật khẩu?
                                </button>
                            )}
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-14 bg-dark-950/60 border border-gray-800 rounded-xl px-5 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:opacity-50 placeholder-gray-600 text-base font-medium"
                            placeholder="••••••••"
                            disabled={isLoading}
                        />
                    </div>
                )}

                {isUpdatePassword && (
                    <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500 ml-1">Xác nhận mật khẩu</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full h-14 bg-dark-950/60 border border-gray-800 rounded-xl px-5 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:opacity-50 placeholder-gray-600 text-base font-medium"
                        placeholder="••••••••"
                        disabled={isLoading}
                    />
                    </div>
                )}

                <button
                type="submit"
                disabled={isLoading}
                className={`w-full h-14 mt-4 flex items-center justify-center font-bold rounded-xl shadow-lg transition-all text-sm uppercase tracking-wide ${
                    isLoading
                    ? 'bg-gray-800 cursor-not-allowed text-gray-400'
                    : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white transform active:scale-[0.98] shadow-brand-500/20'
                }`}
                >
                {isLoading ? (
                    <>
                        <LoadingSpinner /> Đang xử lý...
                    </>
                ) : (
                    isRegister ? 'Tạo Tài Khoản' : 
                    isForgotPassword ? 'Gửi Yêu Cầu' : 
                    isUpdatePassword ? 'Lưu Mật Khẩu' : 'Đăng Nhập'
                )}
                </button>
            </form>
            )}

            {!isUpdatePassword && !isForgotPassword && (
                <>
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-widest">
                            <span className="px-4 bg-dark-900 text-gray-500 font-bold">Hoặc</span>
                        </div>
                    </div>

                    <button 
                        type="button"
                        onClick={onGoogleLogin}
                        disabled={isLoading}
                        className="w-full h-14 flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <GoogleIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>Tiếp tục với Google</span>
                    </button>

                    <div className="mt-8 text-center">
                        <p className="text-gray-400 text-sm">
                            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
                            <button
                                onClick={() => !isLoading && onSwitchView(isRegister ? AppView.LOGIN : AppView.REGISTER)}
                                className="text-brand-400 hover:text-brand-300 font-bold ml-1.5 transition-colors disabled:opacity-50 hover:underline"
                                disabled={isLoading}
                            >
                                {isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}
                            </button>
                        </p>
                    </div>
                </>
            )}

            {isForgotPassword && !resetSent && (
                 <div className="mt-8 text-center">
                     <button
                        onClick={() => onSwitchView(AppView.LOGIN)}
                        className="text-gray-500 hover:text-white text-sm font-medium transition-colors"
                     >
                         &larr; Quay lại Đăng nhập
                     </button>
                 </div>
            )}
        </div>
        
        {/* Back to Home Button Footer */}
        <div className="py-5 border-t border-gray-800/50 bg-dark-950/30 text-center">
            <button
                onClick={() => onSwitchView(AppView.LANDING)}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-400 transition-colors text-xs font-bold uppercase tracking-wider"
                disabled={isLoading}
            >
                <HomeIcon className="w-4 h-4" />
                Về trang chủ
            </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
