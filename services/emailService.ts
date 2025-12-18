
import { supabase } from './supabaseClient';

/**
 * MOCK EMAIL SERVICE
 * Trong môi trường thực tế (Production), bạn sẽ thay thế phần này bằng việc gọi API tới Backend
 * hoặc sử dụng các dịch vụ bên thứ 3 như EmailJS, SendGrid, Mailgun.
 */

export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  console.group('%c 📧 MOCK EMAIL SERVER LOG', 'color: #0ea5e9; font-weight: bold; font-size: 14px;');
  console.log('Đang kết nối tới máy chủ SMTP...');
  
  // Giả lập độ trễ mạng
  await new Promise(resolve => setTimeout(resolve, 1500));

  const emailContent = `
  =============================================================
  FROM: no-reply@web2.invest
  TO: ${email}
  SUBJECT: Chào mừng ${name} gia nhập Web2 Invest Pro! 🚀
  =============================================================
  
  Xin chào ${name},

  Chúc mừng bạn đã đăng ký tài khoản thành công tại Web2 Invest Pro!
  
  Thông tin tài khoản:
  - Email: ${email}
  - Ngày tham gia: ${new Date().toLocaleDateString('vi-VN')}
  - Gói thành viên: Standard

  Bắt đầu hành trình đầu tư thông minh ngay hôm nay:
  1. Nạp tiền qua Metamask hoặc Thẻ tín dụng.
  2. Theo dõi biểu đồ tăng trưởng tài sản.
  3. Nhận tư vấn từ AI Advisor.

  Nếu bạn cần hỗ trợ, vui lòng liên hệ support@web2.invest.

  Trân trọng,
  Đội ngũ Web2 Invest Pro.
  =============================================================
  `;

  console.log(emailContent);
  console.log('%c ✅ Đã gửi email thành công!', 'color: green; font-weight: bold;');
  console.groupEnd();

  return true;
};

export const sendReferralNotification = async (referrerId: string, newUserName: string): Promise<void> => {
    try {
        // 1. Lấy email của người giới thiệu từ Supabase
        const { data: referrer, error } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', referrerId)
            .single();

        if (error || !referrer) {
            console.warn("Không tìm thấy người giới thiệu để gửi mail.");
            return;
        }

        console.group('%c 📧 REFERRAL NOTIFICATION LOG', 'color: #f59e0b; font-weight: bold; font-size: 14px;');
        console.log(`Đang gửi mail báo cáo cho Sponsor: ${referrer.email}...`);

        // Giả lập độ trễ
        await new Promise(resolve => setTimeout(resolve, 1000));

        const emailContent = `
        =============================================================
        FROM: no-reply@web2.invest
        TO: ${referrer.email} (Sponsor)
        SUBJECT: 🌟 Chúc mừng! Bạn có thành viên mới: ${newUserName}
        =============================================================
        
        Xin chào ${referrer.full_name},

        Hệ thống vừa ghi nhận một thành viên mới đăng ký qua link giới thiệu của bạn!

        👤 Thành viên mới: ${newUserName}
        📅 Thời gian: ${new Date().toLocaleString('vi-VN')}
        
        Bạn có thể đăng nhập vào Dashboard -> Mục "Hệ thống" để xem chi tiết và theo dõi doanh số đầu tư của thành viên này.

        Tiếp tục phát triển hệ thống để nhận thêm hoa hồng nhé!

        Trân trọng,
        Đội ngũ Web2 Invest Pro.
        =============================================================
        `;

        console.log(emailContent);
        console.log('%c ✅ Đã gửi thông báo Referrer thành công!', 'color: green; font-weight: bold;');
        console.groupEnd();

    } catch (err) {
        console.error("Lỗi gửi mail referrer:", err);
    }
};
