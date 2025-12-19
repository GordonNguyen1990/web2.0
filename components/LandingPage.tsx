
import React from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, Zap, Globe, CreditCard, Lock, ArrowRight, CheckCircle } from './Icons';

interface LandingPageProps {
  onLoginClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  return (
    <div className="min-h-screen bg-dark-950 font-sans text-white selection:bg-brand-500 selection:text-white overflow-hidden">
      
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-dark-950/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Web2 Invest<span className="text-brand-500">.Pro</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
              <a href="#features" className="hover:text-white transition-colors">Tính năng</a>
              <a href="#payments" className="hover:text-white transition-colors">Thanh toán</a>
              <a href="#stats" className="hover:text-white transition-colors">Thống kê</a>
            </div>
            <button
              onClick={onLoginClick}
              className="px-6 py-2.5 bg-white text-dark-950 font-bold rounded-full hover:bg-gray-200 transition-all transform hover:scale-105 shadow-lg shadow-white/10"
            >
              Đăng nhập / Đăng ký
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen animate-float"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-sm font-medium text-gray-300">Hệ thống đầu tư tự động 24/7</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-display font-bold leading-tight mb-8">
              Đầu tư thông minh <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 via-purple-500 to-orange-500">
                Lợi nhuận bền vững
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Nền tảng tài chính phi tập trung thế hệ mới. Tích hợp thanh toán đa kênh (Crypto, MoMo, VietQR) giúp bạn nạp rút dễ dàng và sinh lời thụ động.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onLoginClick}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                Bắt đầu ngay <ArrowRight className="w-5 h-5" />
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl backdrop-blur-sm transition-all">
                Tìm hiểu thêm
              </button>
            </div>
          </motion.div>

          {/* Floating UI Elements (Mockup) */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-20 relative mx-auto max-w-4xl"
          >
            <div className="bg-dark-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl shadow-brand-900/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Mock Card 1 */}
                    <div className="bg-dark-950 p-4 rounded-xl border border-white/5">
                        <div className="text-gray-400 text-sm mb-2">Tổng tài sản</div>
                        <div className="text-3xl font-mono font-bold text-white">$24,592.00</div>
                        <div className="text-green-400 text-sm mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> +12.5% tháng này
                        </div>
                    </div>
                     {/* Mock Card 2 */}
                     <div className="bg-dark-950 p-4 rounded-xl border border-white/5">
                        <div className="text-gray-400 text-sm mb-2">Lãi suất (APY)</div>
                        <div className="text-3xl font-mono font-bold text-brand-500">18.2%</div>
                        <div className="text-gray-500 text-sm mt-1">Cố định hàng năm</div>
                    </div>
                     {/* Mock Card 3 */}
                     <div className="bg-dark-950 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                         <div>
                            <div className="text-gray-400 text-sm mb-2">Trạng thái</div>
                            <div className="text-green-400 font-bold flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Hoạt động
                            </div>
                         </div>
                         <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
                             <Zap className="w-6 h-6" />
                         </div>
                    </div>
                </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-dark-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Tại sao chọn chúng tôi?</h2>
                <p className="text-gray-400 max-w-2xl mx-auto text-lg">Hệ thống được tối ưu hóa cho cả người mới bắt đầu và nhà đầu tư chuyên nghiệp.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { icon: Shield, title: "An toàn tuyệt đối", desc: "Bảo mật đa lớp, mã hóa dữ liệu và xác thực 2 yếu tố (2FA) giúp tài sản của bạn luôn an toàn." },
                    { icon: Zap, title: "Nạp rút siêu tốc", desc: "Hệ thống xử lý tự động. Tiền về tài khoản chỉ trong vài phút thông qua Blockchain hoặc Ngân hàng." },
                    { icon: Globe, title: "Đa nền tảng", desc: "Truy cập và quản lý danh mục đầu tư mọi lúc mọi nơi trên mọi thiết bị." }
                ].map((feature, idx) => (
                    <motion.div 
                        key={idx}
                        whileHover={{ y: -10 }}
                        className="p-8 rounded-2xl bg-dark-800 border border-white/5 hover:border-brand-500/30 transition-all group"
                    >
                        <div className="w-14 h-14 bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-500 mb-6 group-hover:bg-brand-500 group-hover:text-white transition-all">
                            <feature.icon className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                        <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section id="payments" className="py-20 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <h3 className="text-xl text-gray-400 mb-10 font-medium">Hỗ trợ thanh toán đa kênh</h3>
            <div className="flex flex-wrap justify-center gap-12 items-center opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="flex items-center gap-2 text-2xl font-bold text-white"><span className="text-[#A50064]">MoMo</span> Wallet</div>
                <div className="flex items-center gap-2 text-2xl font-bold text-white"><span className="text-[#0052CC]">VietQR</span> Banking</div>
                <div className="flex items-center gap-2 text-2xl font-bold text-white"><span className="text-[#F3BA2F]">Binance</span> Pay</div>
                <div className="flex items-center gap-2 text-2xl font-bold text-white"><span className="text-[#26A17B]">Tether</span> USDT</div>
            </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-brand-600/10"></div>
        <div className="max-w-5xl mx-auto px-4 relative z-10 text-center">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">Sẵn sàng gia tăng tài sản?</h2>
            <p className="text-xl text-gray-300 mb-10">Đăng ký tài khoản ngay hôm nay và nhận ưu đãi đặc biệt cho thành viên mới.</p>
            <button
              onClick={onLoginClick}
              className="px-12 py-5 bg-white text-dark-950 text-lg font-bold rounded-xl hover:bg-gray-100 transition-all shadow-2xl shadow-white/20 transform hover:-translate-y-1"
            >
              Tạo tài khoản miễn phí
            </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-950 border-t border-white/10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                <div className="col-span-1 md:col-span-1">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">Web2 Invest</span>
                    </div>
                    <p className="text-gray-500 text-sm">Nền tảng đầu tư tài chính số 1 Châu Á. Uy tín, Minh bạch, Hiệu quả.</p>
                </div>
                <div>
                    <h4 className="font-bold text-white mb-4">Về chúng tôi</h4>
                    <ul className="space-y-2 text-gray-500 text-sm">
                        <li><a href="#" className="hover:text-brand-500">Giới thiệu</a></li>
                        <li><a href="#" className="hover:text-brand-500">Đội ngũ</a></li>
                        <li><a href="#" className="hover:text-brand-500">Liên hệ</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-white mb-4">Hỗ trợ</h4>
                    <ul className="space-y-2 text-gray-500 text-sm">
                        <li><a href="#" className="hover:text-brand-500">Trung tâm trợ giúp</a></li>
                        <li><a href="#" className="hover:text-brand-500">Điều khoản sử dụng</a></li>
                        <li><a href="#" className="hover:text-brand-500">Chính sách bảo mật</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-white mb-4">Kết nối</h4>
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-gray-400 hover:bg-brand-500 hover:text-white transition-all cursor-pointer">
                            <Globe className="w-5 h-5" />
                        </div>
                        {/* More social icons can go here */}
                    </div>
                </div>
            </div>
            <div className="border-t border-white/5 pt-8 text-center text-gray-600 text-sm">
                &copy; 2024 Web2 Invest Pro. All rights reserved.
            </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
