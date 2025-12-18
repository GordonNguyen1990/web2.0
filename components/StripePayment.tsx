import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Using Stripe's standard public test key
// NOTE: For best results, register at dashboard.stripe.com and use your own Publishable Key
const stripePromise = loadStripe('pk_test_TYooMQauvdEDq54NiTphI7jx');

interface StripePaymentFormProps {
  onSuccess: (amount: number) => void;
}

const CheckoutForm: React.FC<StripePaymentFormProps> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.error("Stripe.js has not loaded yet.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setProcessing(true);
    setError(null);

    try {
      // 1. Create a Token
      // In Test Mode, Real cards will trigger an error immediately.
      const { error: stripeError, token } = await stripe.createToken(cardElement);

      if (stripeError) {
        console.error("Stripe Error:", stripeError);
        setError(stripeError.message || 'Thanh toán thất bại. Vui lòng kiểm tra lại thông tin thẻ.');
        setProcessing(false);
      } else if (token) {
        console.log('Stripe Token Created Success:', token);
        
        // Simulate backend processing time
        setTimeout(() => {
          setProcessing(false);
          const val = parseFloat(amount);
          if (val > 0) {
            onSuccess(val);
            setAmount('');
            elements.getElement(CardElement)?.clear();
          } else {
             setError("Số tiền không hợp lệ.");
          }
        }, 1500);
      }
    } catch (err) {
      console.error("System Error:", err);
      setError("Đã có lỗi hệ thống xảy ra. Vui lòng thử lại.");
      setProcessing(false);
    }
  };

  const cardStyle = {
    style: {
      base: {
        color: "#f8fafc", // white/gray text
        fontFamily: '"Inter", sans-serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": {
          color: "#64748b"
        },
        iconColor: "#0ea5e9"
      },
      invalid: {
        color: "#ef4444",
        iconColor: "#ef4444"
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-300 mb-2">Số tiền nạp (USD)</label>
        <div className="relative">
             <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
            <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-dark-950 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono text-lg"
                placeholder="100.00"
                required
                min="10"
            />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-300">Thông tin thẻ</label>
        <div className="bg-dark-950 border border-gray-700 rounded-lg p-4">
          <CardElement options={cardStyle} />
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded border border-red-400/20 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <button 
        type="submit" 
        disabled={!stripe || processing || !amount}
        className={`w-full py-4 rounded-xl text-base font-bold text-white transition-all transform hover:scale-[1.02] shadow-lg ${
            processing ? 'bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-500/20'
        }`}
      >
        {processing ? 'Đang xử lý giao dịch...' : `Thanh toán ngay ${amount ? `$${amount}` : ''}`}
      </button>
      
      <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-xs">
         <p className="font-bold text-blue-400 mb-1">MÔI TRƯỜNG TESTING:</p>
         <ul className="text-gray-400 list-disc list-inside space-y-1">
            <li>Số thẻ: <span className="font-mono text-white bg-gray-700 px-1 rounded">4242 4242 4242 4242</span></li>
            <li>Ngày hết hạn: Bất kỳ trong tương lai (VD: 12/25)</li>
            <li>CVC: Bất kỳ (VD: 123)</li>
            <li>ZIP Code: Bất kỳ (VD: 10001)</li>
         </ul>
         <p className="mt-2 text-red-400 italic">Không sử dụng thẻ thật tại đây.</p>
      </div>
    </form>
  );
};

const StripePayment: React.FC<StripePaymentFormProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  );
};

export default StripePayment;