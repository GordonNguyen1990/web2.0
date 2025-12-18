
import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') return null;
  return new GoogleGenAI({ apiKey });
};

export const getInvestmentAdvice = async (balance: number, interestRate: number): Promise<string> => {
  const client = getClient();
  if (!client) {
    return "Vui lòng cấu hình API KEY để nhận tư vấn AI.";
  }

  try {
    // Tính toán trước lợi nhuận lãi kép để cung cấp ngữ cảnh chính xác cho AI (tránh hallucination về toán học)
    // Công thức: A = P(1 + r)^n
    const months = 12;
    const projectedBalance = balance * Math.pow((1 + interestRate / 100), months);
    const estimatedProfit = projectedBalance - balance;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `Bạn là 'AI Wealth Advisor' độc quyền của nền tảng Web2 Invest Pro.
        
        NHIỆM VỤ:
        Phân tích tài sản người dùng và đưa ra lời khuyên chiến lược về đầu tư lãi suất kép.
        
        PHONG CÁCH:
        - Chuyên gia tài chính phố Wall: Sắc sảo, ngắn gọn, chuyên nghiệp.
        - Giọng điệu: Khích lệ, lạc quan nhưng thực tế.
        - Ngôn ngữ: Tiếng Việt.
        
        QUY TẮC AN TOÀN:
        - Giới hạn câu trả lời dưới 100 từ.
        - Không cam kết lợi nhuận 100%.
        - Tập trung vào sức mạnh của việc tích lũy tài sản theo thời gian.`,
        temperature: 0.7, // Độ sáng tạo vừa phải
      },
      contents: `DỮ LIỆU ĐẦU VÀO:
      - Số dư hiện tại: $${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      - Lãi suất nền tảng: ${interestRate}%/tháng (Lãi kép).
      - Dự phóng sau 1 năm: Tổng tài sản sẽ đạt khoảng $${projectedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Lãi ròng: +$${estimatedProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}).

      YÊU CẦU:
      Dựa trên số dư hiện tại, hãy đưa ra một lời nhận xét về hiệu quả đầu tư và một lời kêu gọi hành động (Call to Action) cụ thể (ví dụ: Tái đầu tư, Nạp thêm để đạt mốc VIP, hoặc Giữ vững kỷ luật).`,
    });

    return response.text || "Không thể tạo tư vấn lúc này.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Hệ thống AI đang bận, vui lòng thử lại sau.";
  }
};

export const getChatSupportResponse = async (history: {role: string, text: string}[], message: string): Promise<string> => {
    const client = getClient();
    if (!client) return "Hệ thống chưa được cấu hình API Key.";

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `Bạn là Trợ lý Hỗ trợ Khách hàng AI của Web2 Invest Pro (đôi khi được gọi là CSKH hoặc Support Agent).
                
                THÔNG TIN VỀ NỀN TẢNG:
                - Tên: Web2 Invest Pro.
                - Tính năng chính: Kết hợp Web2 (Email/Mật khẩu) và Web3 (Metamask), Nạp/Rút USDT tự động, Lãi suất kép ~5%/tháng.
                - Nạp tiền: Hỗ trợ Crypto (USDT BEP20) và Thẻ tín dụng (Stripe).
                - Rút tiền: Tự động về ví Web3 hoặc tài khoản liên kết. Phí rút ~1.5%.
                - Bảo mật: Có 2FA (Google Authenticator).
                - Đối tác: Sử dụng AI Gemini của Google để tư vấn.

                NHIỆM VỤ:
                - Trả lời các câu hỏi của người dùng một cách ngắn gọn, súc tích, thân thiện.
                - Hướng dẫn người dùng cách nạp tiền, rút tiền, kết nối ví.
                - Giải thích về lãi suất và cơ chế hoạt động.
                
                PHONG CÁCH:
                - Ngôn ngữ: Tiếng Việt.
                - Thân thiện, chuyên nghiệp, kiên nhẫn.
                - Dùng emoji phù hợp để tạo cảm giác gần gũi.
                - Câu trả lời ngắn (dưới 3 câu nếu có thể), đi thẳng vào vấn đề.`,
            },
            contents: [
                ...history.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                })),
                { role: 'user', parts: [{ text: message }] }
            ]
        });

        return response.text || "Xin lỗi, tôi không hiểu câu hỏi. Bạn có thể nói rõ hơn không?";
    } catch (error) {
        console.error("Chat Support Error:", error);
        const msg = (error as any)?.error?.message || (error as any)?.message || '';
        if (typeof msg === 'string' && msg.includes('API key not valid')) {
            return "API Key Gemini không hợp lệ. Vui lòng cấu hình lại.";
        }
        return "Xin lỗi, hệ thống đang bảo trì. Vui lòng thử lại sau ít phút.";
    }
};
