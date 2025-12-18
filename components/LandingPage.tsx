import React from 'react';
import { AppView } from '../types';
import { TrendingUpIcon, WalletIcon, BotIcon, UsersIcon } from './Icons';

interface LandingPageProps {
  onNavigate: (view: AppView) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-x-hidden font-sans">
      {/* Semantic Header */}
      <header className="fixed w-full z-50 bg-dark-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded flex items-center justify-center shadow-lg" aria-hidden="true">
                <TrendingUpIcon className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">WEB2 PRO</span>
            </div>
            <nav className="flex items-center gap-4" aria-label="Main Navigation">
              <button 
                onClick={() => onNavigate(AppView.LOGIN)}
                className="text-gray-300 hover:text-white font-medium text-sm transition-colors"
                aria-label="Đăng nhập vào hệ thống"
              >
                Đăng nhập
              </button>
              <button 
                onClick={() => onNavigate(AppView.REGISTER)}
                className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-brand-500/20 transition-all hover:scale-105"
                aria-label="Đăng ký tài khoản mới"
              >
                Bắt đầu ngay
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden" aria-label="Giới thiệu chung">
          {/* Background blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[100px]"></div>
            <div className="absolute top-[10%] right-[10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px]"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 mb-8">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              <span className="text-brand-300 text-xs font-semibold uppercase tracking-wider">Nền tảng đầu tư 4.0</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Quản Lý Tài Sản <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 via-blue-400 to-purple-400">
                Thông Minh & An Toàn
              </span>
            </h1>
            
            <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-400 mb-10">
              Tối ưu hóa lợi nhuận với công nghệ Web3, nạp rút tự động và sự hỗ trợ phân tích từ AI Gemini.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => onNavigate(AppView.REGISTER)}
                className="px-8 py-4 bg-white text-dark-950 font-bold rounded-xl text-lg hover:bg-gray-100 transition-colors shadow-xl"
              >
                Đăng ký miễn phí
              </button>
              <button 
                onClick={() => onNavigate(AppView.LOGIN)}
                className="px-8 py-4 bg-dark-800 text-white font-bold rounded-xl text-lg border border-gray-700 hover:bg-dark-700 transition-colors"
              >
                Khám phá Dashboard
              </button>
            </div>

            {/* Stats Preview */}
            <div className="mt-20 p-4 bg-dark-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl max-w-4xl mx-auto shadow-2xl">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-gray-800 text-center">
                  <article>
                      <div className="text-3xl font-bold text-white">50K+</div>
                      <div className="text-sm text-gray-500 mt-1">Người dùng</div>
                  </article>
                  <article>
                      <div className="text-3xl font-bold text-brand-400">$10M+</div>
                      <div className="text-sm text-gray-500 mt-1">Tổng tài sản</div>
                  </article>
                  <article>
                      <div className="text-3xl font-bold text-green-400">24/7</div>
                      <div className="text-sm text-gray-500 mt-1">Nạp rút tự động</div>
                  </article>
                  <article>
                      <div className="text-3xl font-bold text-purple-400">AI</div>
                      <div className="text-sm text-gray-500 mt-1">Tư vấn đầu tư</div>
                  </article>
               </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-dark-900 border-y border-gray-800" aria-label="Tính năng nổi bật">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">Tại sao chọn Web2 Pro?</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">Chúng tôi kết hợp sự tiện lợi của Web2 và sự minh bạch của Web3.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <article className="bg-dark-950 p-8 rounded-2xl border border-gray-800 hover:border-brand-500/50 transition-colors group">
                <div className="w-14 h-14 bg-dark-900 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <WalletIcon className="w-8 h-8 text-brand-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Ví Web3 Tích Hợp</h3>
                <p className="text-gray-400 leading-relaxed">
                  Kết nối trực tiếp với Metamask. Nạp và rút tiền (USDT/ETH) hoàn toàn tự động, minh bạch và an toàn.
                </p>
              </article>

              <article className="bg-dark-950 p-8 rounded-2xl border border-gray-800 hover:border-purple-500/50 transition-colors group">
                <div className="w-14 h-14 bg-dark-900 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BotIcon className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">AI Advisor</h3>
                <p className="text-gray-400 leading-relaxed">
                  Trợ lý ảo Gemini AI phân tích danh mục đầu tư của bạn và đưa ra lời khuyên tối ưu hóa lợi nhuận.
                </p>
              </article>

              <article className="bg-dark-950 p-8 rounded-2xl border border-gray-800 hover:border-green-500/50 transition-colors group">
                <div className="w-14 h-14 bg-dark-900 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <UsersIcon className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Hệ Thống Partner</h3>
                <p className="text-gray-400 leading-relaxed">
                  Cơ chế hoa hồng hấp dẫn cho người giới thiệu. Quản lý hệ thống F1 trực quan và chi tiết.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 relative overflow-hidden" aria-label="Kêu gọi hành động">
          <div className="max-w-5xl mx-auto px-4 relative z-10 text-center">
              <h2 className="text-4xl font-bold text-white mb-6">Sẵn sàng để tăng trưởng tài sản?</h2>
              <p className="text-xl text-gray-400 mb-10">Tham gia cùng 50,000+ nhà đầu tư thông minh ngay hôm nay.</p>
              <button 
                  onClick={() => onNavigate(AppView.REGISTER)}
                  className="px-10 py-4 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-2xl transform hover:scale-105 transition-all text-lg"
              >
                  Tạo tài khoản ngay
              </button>
          </div>
        </section>
      </main>

      {/* Semantic Footer */}
      <footer className="bg-dark-950 border-t border-gray-900 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                <div className="col-span-1 md:col-span-1">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUpIcon className="text-brand-500 w-6 h-6" />
                        <span className="text-lg font-bold text-white">WEB2 PRO</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Nền tảng đầu tư tài chính thế hệ mới, tiên phong ứng dụng công nghệ Blockchain và AI.
                    </p>
                </div>
                <div>
                    <h4 className="text-white font-semibold mb-4">Công ty</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li className="hover:text-brand-400 cursor-pointer">Về chúng tôi</li>
                        <li className="hover:text-brand-400 cursor-pointer">Liên hệ</li>
                        <li className="hover:text-brand-400 cursor-pointer">Tuyển dụng</li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-white font-semibold mb-4">Hỗ trợ</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li className="hover:text-brand-400 cursor-pointer">Trung tâm trợ giúp</li>
                        <li className="hover:text-brand-400 cursor-pointer">Điều khoản sử dụng</li>
                        <li className="hover:text-brand-400 cursor-pointer">Chính sách bảo mật</li>
                    </ul>
                </div>
                 <div>
                    <h4 className="text-white font-semibold mb-4">Cộng đồng</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li className="hover:text-brand-400 cursor-pointer">Telegram Group</li>
                        <li className="hover:text-brand-400 cursor-pointer">Twitter (X)</li>
                        <li className="hover:text-brand-400 cursor-pointer">Facebook Fanpage</li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-gray-900 pt-8 text-center text-gray-600 text-sm">
                &copy; 2024 Web2 Invest Pro. All rights reserved.
            </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;