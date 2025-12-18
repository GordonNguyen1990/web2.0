
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie, LineChart, Line } from 'recharts';
import { User, SystemConfig, Transaction, UserRole } from '../types';
import { connectWallet, getWalletBalanceUSD, getSwapQuote, executeSwap } from '../services/web3Service';
import { getInvestmentAdvice } from '../services/geminiService';
import { enrollMFA, verifyMFAEnrollment, getMFAStatus, deleteAllMFAFactors } from '../services/authService';
import StripePayment from './StripePayment';
import { 
  WalletIcon, 
  TrendingUpIcon, 
  ArrowDownIcon, 
  ArrowUpIcon, 
  BotIcon,
  LayoutDashboardIcon,
  HistoryIcon,
  LogOutIcon,
  UsersIcon,
  SettingsIcon,
  CopyIcon,
  BarChartIcon,
  PieChartIcon,
  GlobeIcon,
  RepeatIcon,
  QrCodeIcon
} from './Icons';

interface DashboardProps {
  user: User;
  config: SystemConfig;
  onLogout: () => void;
  onTransaction: (type: 'DEPOSIT' | 'WITHDRAW', amount: number, skipDbUpdate?: boolean) => void;
  onUserUpdate: (user: User) => void;
  onNavigateToAdmin?: () => void;
  transactions: Transaction[];
  referrals: User[];
  onRefreshReferrals?: () => void; // New Prop for manual refresh
}

type TabType = 'dashboard' | 'wallet' | 'market' | 'system' | 'report' | 'settings';

interface CoinData {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number;
    price_change_percentage_24h: number;
    total_volume: number;
    sparkline_in_7d: {
        price: number[];
    };
}

const Dashboard: React.FC<DashboardProps> = ({ user, config, onLogout, onTransaction, onUserUpdate, onNavigateToAdmin, transactions, referrals, onRefreshReferrals }) => {
  // Khởi tạo state từ localStorage để giữ lại Tab khi F5
  const [activeTab, setActiveTab] = useState<TabType>(() => {
      const savedTab = localStorage.getItem('activeTab');
      return (savedTab as TabType) || 'dashboard';
  });

  const [amount, setAmount] = useState<string>('');
  const [fundAction, setFundAction] = useState<'deposit' | 'withdraw' | 'swap'>('deposit');
  const [depositMethod, setDepositMethod] = useState<'crypto' | 'fiat' | 'qr' | 'momo' | 'payos'>('crypto'); 
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [web3BalanceUSD, setWeb3BalanceUSD] = useState<number>(0);

  // Swap State
  const [swapFrom, setSwapFrom] = useState<'BNB' | 'USDT'>('BNB');
  const [swapTo, setSwapTo] = useState<'BNB' | 'USDT'>('USDT');
  const [swapAmount, setSwapAmount] = useState<string>('');
  const [swapOutput, setSwapOutput] = useState<string>('0.00');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string>('');
  const [isQuoting, setIsQuoting] = useState(false); // Trạng thái đang lấy giá

  // CoinPayments State
  const [cpLoading, setCpLoading] = useState(false);
  const [cpResult, setCpResult] = useState<{ address: string, qrcode_url: string, amount: string, confs: number, timeout: number, payment_id: string } | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Polling to verify payment status
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (cpResult && cpResult.payment_id) {
        // Poll every 15 seconds
        intervalId = setInterval(async () => {
            await checkPaymentStatus(cpResult.payment_id);
        }, 15000);
    }

    return () => {
        if (intervalId) clearInterval(intervalId);
    };
  }, [cpResult]);

  const checkPaymentStatus = async (paymentId: string) => {
      try {
          const res = await fetch('/.netlify/functions/verify_payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ payment_id: paymentId })
          });
          const data = await res.json();
          
          if (data.status === 'SUCCESS' || data.status === 'finished' || data.status === 'confirmed') {
              alert("Nạp tiền thành công! Số dư đã được cập nhật.");
              setCpResult(null); // Close QR modal
              
              // Refresh user data or balance
              if (data.new_balance) {
                  onUserUpdate({ ...user, balance: data.new_balance });
              }
              // Trigger transaction history refresh if needed
              onTransaction('DEPOSIT', parseFloat(data.amount || cpResult?.amount || '0'), true);
          }
      } catch (err) {
          console.error("Payment check error", err);
      }
  };

  const handleManualCheckPayment = async () => {
      if (!cpResult?.payment_id) return;
      setIsVerifyingPayment(true);
      await checkPaymentStatus(cpResult.payment_id);
      setIsVerifyingPayment(false);
  };


  // Settings State
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaQR, setMfaQR] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  
  // Withdrawal State
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Ref Data Loading State
  const [isRefreshingRefs, setIsRefreshingRefs] = useState(false);

    // Auto-refresh PROCESSING withdrawals for user
    useEffect(() => {
        const processingWithdrawals = transactions.filter(tx => tx.type === 'WITHDRAW' && tx.status === 'PROCESSING');
        if (processingWithdrawals.length === 0) return;

        // In a real app, we would enable realtime subscription or polling here
        // to update the UI when the status changes from PROCESSING to COMPLETED.
        // For now, we rely on page refresh or manual actions.
    }, [transactions]);

    // Lưu activeTab vào localStorage mỗi khi thay đổi
    useEffect(() => {
      localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (user.walletAddress) {
      const fetchBalance = async () => {
        const bal = await getWalletBalanceUSD(user.walletAddress!);
        setWeb3BalanceUSD(bal);
      };
      fetchBalance();
    }
    checkMFA();
  }, [user.walletAddress]);

  // Effect to fetch swap quote when input changes
  useEffect(() => {
    const fetchQuote = async () => {
        if (!swapAmount || parseFloat(swapAmount) <= 0) {
            setSwapOutput('0.00');
            return;
        }
        
        setIsQuoting(true); // Bắt đầu loading giá
        setSwapOutput('...');
        
        // Debounce reduce to 500ms to avoid spamming RPC
        const timeoutId = setTimeout(async () => {
            try {
                const quote = await getSwapQuote(swapAmount, swapFrom, swapTo);
                if (quote === '0') {
                    setSwapOutput('Lỗi');
                } else {
                    // Hiển thị tối đa 6 số thập phân cho gọn
                    const formatted = parseFloat(quote).toLocaleString('en-US', { maximumFractionDigits: 6 });
                    setSwapOutput(formatted);
                }
            } catch (e) {
                setSwapOutput('Error');
            } finally {
                setIsQuoting(false);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    };
    fetchQuote();
  }, [swapAmount, swapFrom, swapTo]);

  const checkMFA = async () => {
      try {
          const factor = await getMFAStatus();
          setMfaEnabled(!!factor);
      } catch (e) {
          console.error("Check MFA error", e);
      }
  };

  const generateGrowthData = () => {
    const data = [];
    let current = user.balance > 0 ? user.balance : 0; 
    const rate = config.interestRatePercent / 100;
    for (let i = 0; i < 12; i++) {
      data.push({
        name: `T${i + 1}`,
        value: Math.round(current),
      });
      if (user.balance > 0) {
        current = current * (1 + rate);
      }
    }
    return data;
  };

  const chartData = generateGrowthData();

  const handlePayOSDeposit = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) {
          alert("Vui lòng nhập số tiền hợp lệ");
          return;
      }

      try {
          // PayOS usually uses VND. Convert USD -> VND (approx)
          const amountVnd = Math.round(val * 25000); 
          if (amountVnd < 2000) { // PayOS min usually 2000 VND
              alert("Số tiền quá nhỏ.");
              return;
          }

          const res = await fetch('/.netlify/functions/create_payos_payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  amount: amountVnd,
                  userId: user.id
              })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          if (data.checkoutUrl) {
              window.location.href = data.checkoutUrl;
          }
      } catch (err: any) {
          alert("Lỗi tạo thanh toán PayOS: " + err.message);
      }
  };

  const handleMomoDeposit = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) {
          alert("Vui lòng nhập số tiền hợp lệ");
          return;
      }

      try {
          // Convert USD to VND roughly if needed, or just send raw. 
          // MoMo expects VND. Let's assume input is USD and convert x 25000.
          // Or if input is VND, just send it.
          // Let's assume input on UI is USD.
          const amountVnd = Math.round(val * 25000); 
          
          if (amountVnd < 10000) {
              alert("Số tiền nạp tối thiểu là 10,000 VND (~$0.4)");
              return;
          }

          const res = await fetch('/.netlify/functions/create_momo_payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  amount: amountVnd,
                  userId: user.id
              })
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          if (data.payUrl) {
              window.location.href = data.payUrl;
          }
      } catch (err: any) {
          alert("Lỗi tạo thanh toán MoMo: " + err.message);
      }
  };

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    const addr = await connectWallet();
    
    if (addr) {
      onUserUpdate({ ...user, walletAddress: addr });
      const bal = await getWalletBalanceUSD(addr);
      setWeb3BalanceUSD(bal);
    }
    setIsConnecting(false);
  };

  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    if (fundAction === 'withdraw') {
        if (val > user.balance) {
            alert("Số dư không đủ!");
            return;
        }
        if (!withdrawAddress) {
            alert("Vui lòng nhập địa chỉ ví nhận tiền!");
            return;
        }

        setIsWithdrawing(true);
        try {
            const res = await fetch('/.netlify/functions/create_withdrawal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    amount: val,
                    wallet_address: withdrawAddress
                })
            });
            
            let data;
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await res.json();
            } else {
                const text = await res.text();
                console.error("Non-JSON response:", text);
                throw new Error("Server Error: " + (res.statusText || "Invalid response"));
            }
            
            if (data.error) throw new Error(data.error);
            
            alert("Yêu cầu rút tiền thành công! Vui lòng chờ Admin phê duyệt.");
            onUserUpdate({ ...user, balance: data.new_balance });
            onTransaction('WITHDRAW', val, true); // Update history without extra DB call
            setAmount('');
            setWithdrawAddress('');
        } catch (err: any) {
            alert("Lỗi rút tiền: " + err.message);
        } finally {
            setIsWithdrawing(false);
        }
        return;
    }

    onTransaction(fundAction === 'deposit' ? 'DEPOSIT' : 'WITHDRAW', val);
    setAmount('');
  };
  
  const handleGenerateQR = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) {
          alert("Vui lòng nhập số tiền hợp lệ");
          return;
      }

      setCpLoading(true);
      setCpResult(null);

      try {
          const response = await fetch('/.netlify/functions/create_payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  amount: val,
                  userId: user.id
              })
          });
          
          const data = await response.json();
          if (data.error) throw new Error(data.error || "Có lỗi xảy ra");
          
          setCpResult(data);
      } catch (err: any) {
          alert("Lỗi tạo mã QR: " + err.message);
      } finally {
          setCpLoading(false);
      }
  };

  const handleSwapSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user.walletAddress) {
          alert("Vui lòng kết nối ví Metamask để thực hiện Swap.");
          return;
      }
      const val = parseFloat(swapAmount);
      if (isNaN(val) || val <= 0) return;

      setIsSwapping(true);
      setSwapStatus("Đang kết nối Blockchain...");

      const success = await executeSwap(swapAmount, swapFrom, swapTo, (status) => {
          setSwapStatus(status);
      });

      if (success) {
          alert(`Hoán đổi thành công! ${swapAmount} ${swapFrom} sang ${swapTo}.`);
          setSwapAmount('');
          setSwapOutput('0.00');
          // Refresh balance
          const bal = await getWalletBalanceUSD(user.walletAddress);
          setWeb3BalanceUSD(bal);
      } else {
          if (!swapStatus.includes("thất bại") && !swapStatus.includes("Lỗi")) {
              setSwapStatus("Giao dịch bị hủy hoặc thất bại.");
          }
      }
      
      setIsSwapping(false);
      setTimeout(() => setSwapStatus(''), 5000);
  };

  const handleStripeSuccess = (val: number) => {
      onTransaction('DEPOSIT', val);
      alert(`Nạp thành công $${val} qua Stripe!`);
  };

  const handleAskAI = async () => {
    setLoadingAi(true);
    const advice = await getInvestmentAdvice(user.balance, config.interestRatePercent);
    setAiAdvice(advice);
    setLoadingAi(false);
  };

  const handleManualRefresh = async () => {
      if (onRefreshReferrals) {
          setIsRefreshingRefs(true);
          await onRefreshReferrals();
          setTimeout(() => setIsRefreshingRefs(false), 500);
      } else {
          window.location.reload();
      }
  };

  // --- MFA HANDLERS ---
  const handleStartMFA = async () => {
      setIsLoadingSettings(true);
      try {
          const data = await enrollMFA();
          setMfaQR(data.totp.qr_code);
          setMfaSecret(data.id); // Save factor ID temporarily
          setIsEnrollingMfa(true);
      } catch (error: any) {
          alert("Lỗi khởi tạo MFA: " + error.message);
      } finally {
          setIsLoadingSettings(false);
      }
  };

  const handleVerifyMFA = async () => {
      setIsLoadingSettings(true);
      try {
          await verifyMFAEnrollment(mfaSecret, mfaCode);
          setMfaEnabled(true);
          setIsEnrollingMfa(false);
          setMfaCode('');
          alert("Kích hoạt bảo mật 2 lớp thành công!");
      } catch (error: any) {
          alert("Mã xác thực không đúng.");
      } finally {
          setIsLoadingSettings(false);
      }
  };

  const handleDisableMFA = async () => {
      if (!window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn TẮT bảo mật 2 lớp?\n\nTài khoản của bạn sẽ kém an toàn hơn. Nếu bạn đang gặp lỗi xác thực, hành động này sẽ reset lại toàn bộ cài đặt 2FA.")) return;
      
      setIsLoadingSettings(true);
      try {
          // Gọi hàm xóa toàn bộ factors để đảm bảo sạch sẽ (Clean slate)
          await deleteAllMFAFactors();
          setMfaEnabled(false);
          setIsEnrollingMfa(false);
          alert("Đã tắt xác thực 2 lớp thành công. Tài khoản của bạn đã trở về trạng thái đăng nhập bằng mật khẩu thường.");
      } catch (error: any) {
          alert("Lỗi tắt MFA: " + error.message);
      } finally {
          setIsLoadingSettings(false);
      }
  };

  const Overview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-dark-900 rounded-xl p-6 border border-gray-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full -mr-8 -mt-8 group-hover:bg-brand-500/10 transition-colors"></div>
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Số dư đầu tư (Web2)</h3>
          <div className="text-3xl font-bold text-white font-mono mb-1">
              ${user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center text-xs text-green-400 gap-1">
              <ArrowUpIcon className="w-3 h-3" />
              <span>Đang sinh lời</span>
          </div>
        </div>

        <div className="bg-dark-900 rounded-xl p-6 border border-gray-800 shadow-sm relative overflow-hidden">
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Ví Metamask (Web3)</h3>
          <div className="text-3xl font-bold text-orange-400 font-mono mb-1">
              ${web3BalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center text-xs text-gray-500 gap-1">
              <span>Trên BNB Smart Chain</span>
          </div>
        </div>

        <div className="bg-dark-900 rounded-xl p-6 border border-gray-800 shadow-sm relative overflow-hidden">
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Lãi suất hệ thống</h3>
          <div className="text-3xl font-bold text-brand-400 font-mono mb-1">
              {config.interestRatePercent}%
              <span className="text-lg text-gray-500 ml-1">/tháng</span>
          </div>
          <div className="flex items-center text-xs text-brand-300 gap-1">
              <span>Cố định trong 12 tháng</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-900 rounded-xl border border-gray-800 shadow-sm p-6 h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-white">Dự báo tăng trưởng</h3>
              <p className="text-xs text-gray-500">Mô phỏng lãi suất kép trong 12 tháng</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                  <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#e0f2fe' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
              </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <div className="bg-dark-900 rounded-xl border border-gray-800 shadow-sm p-5">
              <div className="text-center mb-4">
                 <div className="w-16 h-16 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 p-[2px] mx-auto mb-2">
                    <div className="w-full h-full rounded-full bg-dark-900 flex items-center justify-center text-xl font-bold">
                       {user.name.charAt(0)}
                    </div>
                 </div>
                 <h3 className="font-bold text-white">{user.name}</h3>
                 <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                 <div className="bg-dark-950 p-2 rounded border border-gray-800">
                    <div className="text-gray-500">Hạng</div>
                    <div className="font-bold text-brand-400">V.I.P</div>
                 </div>
                 <div className="bg-dark-950 p-2 rounded border border-gray-800">
                    <div className="text-gray-500">ID</div>
                    <div className="font-bold text-white">#{user.id.slice(-4)}</div>
                 </div>
              </div>
           </div>

           <div className="bg-gradient-to-br from-purple-900/20 to-brand-900/20 rounded-xl border border-brand-500/20 shadow-sm p-5 relative">
              <div className="flex items-center gap-2 mb-3">
                 <BotIcon className="text-brand-400 w-5 h-5" />
                 <h3 className="font-semibold text-white">AI Advisor</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4 line-clamp-3">
                 {aiAdvice || "Nhấn phân tích để nhận lời khuyên đầu tư từ Gemini AI."}
              </p>
              <button onClick={handleAskAI} className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded transition-colors">
                  {loadingAi ? '...' : 'Phân tích ngay'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );

  const WalletView = () => {
    const hasBalance = user.balance > 0;
    const portfolioData = hasBalance ? [
        { name: 'Khả dụng', value: user.balance, color: '#0ea5e9' },
        { name: 'Đang đầu tư', value: user.balance * 4, color: '#6366f1' }, 
        { name: 'Thưởng', value: user.balance * 0.5, color: '#10b981' }, 
    ] : [
        { name: 'Trống', value: 1, color: '#1e293b' }
    ];
    
    const totalAsset = hasBalance ? portfolioData.reduce((acc, item) => acc + item.value, 0) : 0;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Ví Của Tôi</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-dark-900 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center relative">
                    <h3 className="absolute top-6 left-6 font-semibold text-gray-400 text-sm uppercase">Danh mục tài sản</h3>
                    <div className="w-full h-64 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={portfolioData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {portfolioData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} itemStyle={{color: '#fff'}} />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-2">
                        <span className="text-xs text-gray-500 block">Tổng</span>
                        <span className="text-lg font-bold text-white">${totalAsset.toLocaleString()}</span>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-dark-900 rounded-xl border border-gray-800 p-6">
                   <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-white">Giao dịch</h3>
                        <div className="flex bg-dark-950 rounded-lg p-1 border border-gray-800">
                             <button 
                                onClick={() => { setFundAction('deposit'); setDepositMethod('crypto'); }}
                                className={`px-4 py-2 text-sm font-medium rounded transition-all ${fundAction === 'deposit' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                             >
                                Nạp tiền
                             </button>
                             <button 
                                onClick={() => setFundAction('withdraw')}
                                className={`px-4 py-2 text-sm font-medium rounded transition-all ${fundAction === 'withdraw' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                             >
                                Rút tiền
                             </button>
                             <button 
                                onClick={() => setFundAction('swap')}
                                className={`px-4 py-2 text-sm font-medium rounded transition-all flex items-center gap-1 ${fundAction === 'swap' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                             >
                                <RepeatIcon className="w-4 h-4" /> PancakeSwap
                             </button>
                        </div>
                   </div>

                   {fundAction === 'deposit' ? (
                       <div className="space-y-4 animate-fadeIn">
                           <div className="grid grid-cols-3 gap-2 mb-4">
                               <button 
                                   onClick={() => setDepositMethod('crypto')}
                                   className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                       depositMethod === 'crypto' 
                                       ? 'bg-brand-500/10 border-brand-500 text-brand-400' 
                                       : 'bg-dark-950 border-gray-800 text-gray-400 hover:border-gray-600'
                                   }`}
                               >
                                   <WalletIcon className="w-4 h-4" />
                                   <span className="font-medium text-xs">Web3</span>
                               </button>
                               <button 
                                   onClick={() => setDepositMethod('qr')}
                                   className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                       depositMethod === 'qr' 
                                       ? 'bg-green-500/10 border-green-500 text-green-400' 
                                       : 'bg-dark-950 border-gray-800 text-gray-400 hover:border-gray-600'
                                   }`}
                               >
                                   <QrCodeIcon className="w-4 h-4" />
                                   <span className="font-medium text-xs">QR Code</span>
                               </button>
                               <button 
                                   onClick={() => setDepositMethod('fiat')}
                                   className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                       depositMethod === 'fiat' 
                                       ? 'bg-purple-500/10 border-purple-500 text-purple-400' 
                                       : 'bg-dark-950 border-gray-800 text-gray-400 hover:border-gray-600'
                                   }`}
                               >
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                   <span className="font-medium text-xs">Visa/Master</span>
                               </button>
                               <button 
                                   onClick={() => setDepositMethod('momo')}
                                   className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                       depositMethod === 'momo' 
                                       ? 'bg-pink-500/10 border-pink-500 text-pink-400' 
                                       : 'bg-dark-950 border-gray-800 text-gray-400 hover:border-gray-600'
                                   }`}
                               >
                                   <span className="font-bold text-xs">MoMo</span>
                               </button>
                               <button 
                                   onClick={() => setDepositMethod('payos')}
                                   className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                       depositMethod === 'payos' 
                                       ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
                                       : 'bg-dark-950 border-gray-800 text-gray-400 hover:border-gray-600'
                                   }`}
                               >
                                   <span className="font-bold text-xs">VietQR</span>
                               </button>
                           </div>

                           {depositMethod === 'crypto' ? (
                               <form onSubmit={handleFundSubmit} className="space-y-4 max-w-lg">
                                    <div className="bg-dark-950 p-4 rounded-xl border border-gray-800 flex justify-between items-center">
                                        <div>
                                            <span className="text-xs text-gray-500 uppercase block">Số dư Web2 (Nội bộ)</span>
                                            <span className="text-xl font-bold text-white font-mono">${user.balance.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/20">
                                         <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs text-orange-400 uppercase font-bold flex items-center gap-1">
                                                <WalletIcon className="w-3 h-3" /> Ví Metamask (BNB Chain)
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {user.walletAddress ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400 font-mono bg-dark-900 px-2 py-1 rounded">
                                                            {user.walletAddress.slice(0,6)}...{user.walletAddress.slice(-4)}
                                                        </span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => onUserUpdate({ ...user, walletAddress: undefined })}
                                                            className="text-gray-500 hover:text-red-400"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        type="button" 
                                                        onClick={handleConnectWallet} 
                                                        disabled={isConnecting}
                                                        className="text-xs text-orange-400 hover:text-orange-300 font-bold underline"
                                                    >
                                                        {isConnecting ? 'Đang kết nối...' : 'Kết nối ngay'}
                                                    </button>
                                                )}
                                            </div>
                                         </div>
                                         
                                         {user.walletAddress && (
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <span className="text-xs text-gray-500 block">Tổng tài sản ước tính (USD)</span>
                                                    <span className="text-2xl font-bold text-orange-400 font-mono">
                                                        ${web3BalanceUSD.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="text-right text-[10px] text-gray-600">
                                                    * Bao gồm BNB & USDT
                                                </div>
                                            </div>
                                         )}
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Số tiền muốn nạp (USDT)</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full bg-dark-950 border border-gray-700 rounded-lg pl-4 pr-16 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono text-lg"
                                                placeholder="0.00"
                                            />
                                            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">USDT</span>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit"
                                        className="w-full py-4 rounded-xl text-base font-bold text-white transition-all transform hover:scale-[1.02] bg-gradient-to-r from-brand-600 to-brand-500 shadow-lg shadow-brand-500/20"
                                    >
                                        Xác nhận Nạp USDT
                                    </button>
                               </form>
                           ) : depositMethod === 'qr' ? (
                               <div className="max-w-lg space-y-4">
                                   {!cpResult ? (
                                       <form onSubmit={handleGenerateQR} className="space-y-4">
                                            <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20 text-sm text-green-300">
                                                Hệ thống sẽ tạo mã QR USDT (BEP20). Tiền sẽ tự động cộng vào tài khoản sau khi giao dịch được Blockchain xác nhận (2-5 phút).
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-300 mb-2">Số tiền nạp (USD)</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number"
                                                        value={amount}
                                                        onChange={(e) => setAmount(e.target.value)}
                                                        className="w-full bg-dark-950 border border-gray-700 rounded-lg pl-4 pr-16 py-3 text-white focus:ring-2 focus:ring-green-500 outline-none font-mono text-lg"
                                                        placeholder="50.00"
                                                        min="10"
                                                    />
                                                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
                                                </div>
                                            </div>
                                            <button 
                                                type="submit"
                                                disabled={cpLoading}
                                                className={`w-full py-4 rounded-xl text-base font-bold text-white transition-all transform hover:scale-[1.02] ${cpLoading ? 'bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-green-500 shadow-lg shadow-green-500/20'}`}
                                            >
                                                {cpLoading ? 'Đang tạo mã...' : 'Lấy Mã QR USDT'}
                                            </button>
                                       </form>
                                   ) : (
                                       <div className="bg-white p-6 rounded-xl text-center space-y-4 animate-fadeIn text-gray-900">
                                           <h3 className="text-lg font-bold text-green-600 uppercase">Quét mã để thanh toán</h3>
                                           <div className="bg-gray-100 p-2 rounded-lg inline-block border-2 border-dashed border-gray-300">
                                                <img src={cpResult.qrcode_url} alt="QR Code" className="w-48 h-48 mx-auto" />
                                           </div>
                                           <div className="space-y-2 text-left bg-gray-50 p-4 rounded border border-gray-200">
                                               <div>
                                                   <span className="text-xs text-gray-500 block uppercase font-bold">Số tiền cần chuyển:</span>
                                                   <div className="font-mono text-lg font-bold text-red-600">{cpResult.amount} USDT</div>
                                               </div>
                                               <div>
                                                   <span className="text-xs text-gray-500 block uppercase font-bold">Địa chỉ ví (BEP20):</span>
                                                   <div className="font-mono text-xs break-all bg-white border border-gray-200 p-2 rounded flex items-center justify-between">
                                                       {cpResult.address}
                                                       <button onClick={() => navigator.clipboard.writeText(cpResult.address)} className="text-brand-500 hover:text-brand-700 font-bold ml-2">COPY</button>
                                                   </div>
                                               </div>
                                           </div>
                                           <p className="text-xs text-gray-500">
                                               Giao dịch sẽ tự động hoàn tất sau khoảng {cpResult.timeout / 60} phút. Vui lòng không đóng trang này cho đến khi bạn chuyển tiền xong.
                                           </p>
                                           <div className="flex gap-4 justify-center">
                                                <button onClick={handleManualCheckPayment} disabled={isVerifyingPayment} className="text-sm font-bold text-brand-500 hover:text-brand-400 border border-brand-500/30 px-4 py-2 rounded-lg transition-colors">
                                                    {isVerifyingPayment ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái'}
                                                </button>
                                                <button onClick={() => setCpResult(null)} className="text-sm text-gray-500 underline hover:text-gray-800">
                                                    Tạo mã mới
                                                </button>
                                           </div>
                                       </div>
                                   )}
                               </div>
                           ) : depositMethod === 'momo' ? (
                               <div className="max-w-lg space-y-4">
                                   <form onSubmit={handleMomoDeposit} className="space-y-4">
                                        <div className="bg-pink-500/10 p-4 rounded-xl border border-pink-500/20 text-sm text-pink-300">
                                            Nạp tiền qua Ví điện tử MoMo (QR Code / ATM). Tỉ giá quy đổi: $1 = 25,000 VND.
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-300 mb-2">Số tiền nạp (USD)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    className="w-full bg-dark-950 border border-gray-700 rounded-lg pl-4 pr-16 py-3 text-white focus:ring-2 focus:ring-pink-500 outline-none font-mono text-lg"
                                                    placeholder="10.00"
                                                    min="1"
                                                />
                                                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
                                            </div>
                                            {amount && (
                                                <p className="text-xs text-gray-500 mt-1 text-right">
                                                    ≈ {(parseFloat(amount) * 25000).toLocaleString()} VND
                                                </p>
                                            )}
                                        </div>
                                        <button 
                                            type="submit"
                                            className="w-full py-4 rounded-xl text-base font-bold text-white transition-all transform hover:scale-[1.02] bg-gradient-to-r from-pink-600 to-pink-500 shadow-lg shadow-pink-500/20"
                                        >
                                            Thanh toán MoMo
                                        </button>
                                   </form>
                               </div>
                           ) : depositMethod === 'payos' ? (
                               <div className="max-w-lg space-y-4">
                                   <form onSubmit={handlePayOSDeposit} className="space-y-4">
                                        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-sm text-blue-300">
                                            Chuyển khoản ngân hàng tự động (VietQR). Hệ thống xác nhận sau 1-3 phút.
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-300 mb-2">Số tiền nạp (USD)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    className="w-full bg-dark-950 border border-gray-700 rounded-lg pl-4 pr-16 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-lg"
                                                    placeholder="10.00"
                                                    min="1"
                                                />
                                                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
                                            </div>
                                            {amount && (
                                                <p className="text-xs text-gray-500 mt-1 text-right">
                                                    ≈ {(parseFloat(amount) * 25000).toLocaleString()} VND
                                                </p>
                                            )}
                                        </div>
                                        <button 
                                            type="submit"
                                            className="w-full py-4 rounded-xl text-base font-bold text-white transition-all transform hover:scale-[1.02] bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20"
                                        >
                                            Tạo mã VietQR
                                        </button>
                                   </form>
                               </div>
                           ) : (
                               <div className="max-w-lg">
                                   <StripePayment onSuccess={handleStripeSuccess} />
                               </div>
                           )}
                       </div>
                   ) : fundAction === 'withdraw' ? (
                       <form onSubmit={handleFundSubmit} className="space-y-4 max-w-lg animate-fadeIn">
                          <div className="bg-dark-950 p-4 rounded-xl border border-gray-800 flex justify-between items-center">
                              <div>
                                  <span className="text-xs text-gray-500 uppercase block">Số dư hiện tại</span>
                                  <span className="text-xl font-bold text-white font-mono">${user.balance.toLocaleString()}</span>
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm text-gray-300 mb-2">Số tiền Rút (USDT)</label>
                              <div className="relative">
                                  <input 
                                      type="number"
                                      value={amount}
                                      onChange={(e) => setAmount(e.target.value)}
                                      className="w-full bg-dark-950 border border-gray-700 rounded-lg pl-4 pr-16 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono text-lg"
                                      placeholder="0.00"
                                  />
                                  <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">USDT</span>
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm text-gray-300 mb-2">Địa chỉ ví nhận tiền (BEP20)</label>
                              <div className="relative">
                                  <input 
                                      type="text"
                                      value={withdrawAddress}
                                      onChange={(e) => setWithdrawAddress(e.target.value)}
                                      className="w-full bg-dark-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                                      placeholder="0x..."
                                  />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Lưu ý: Chỉ hỗ trợ mạng BNB Chain (BEP20). Nhập sai ví có thể mất tiền.</p>
                          </div>

                          <div className="flex justify-between items-center text-sm p-3 bg-orange-900/10 border border-orange-900/30 rounded-lg text-orange-300">
                              <span>Phí giao dịch ({config.withdrawalFeePercent}%)</span>
                              <span className="font-mono">-${amount ? (parseFloat(amount) * config.withdrawalFeePercent / 100).toFixed(2) : '0.00'}</span>
                          </div>

                          <button 
                              type="submit"
                              disabled={isWithdrawing}
                              className={`w-full py-4 rounded-xl text-base font-bold text-white transition-all transform hover:scale-[1.02] ${isWithdrawing ? 'bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-orange-600 to-orange-500 shadow-lg shadow-orange-500/20'}`}
                          >
                              {isWithdrawing ? 'Đang gửi yêu cầu...' : 'Yêu cầu Rút về Ví'}
                          </button>
                       </form>
                   ) : (
                       /* --- SWAP UI (UPDATED FOR PANCAKESWAP) --- */
                       <form onSubmit={handleSwapSubmit} className="space-y-6 max-w-lg animate-fadeIn">
                           <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 p-4 rounded-xl border border-purple-500/20 relative">
                               <div className="flex justify-between items-center mb-2">
                                   <span className="text-xs text-purple-400 font-bold uppercase">Bạn gửi</span>
                               </div>
                               <div className="flex gap-4">
                                    <input 
                                        type="number"
                                        value={swapAmount}
                                        onChange={(e) => setSwapAmount(e.target.value)}
                                        className="flex-1 bg-transparent text-2xl font-bold text-white outline-none placeholder-gray-700 font-mono"
                                        placeholder="0.0"
                                    />
                                    <select 
                                        value={swapFrom}
                                        onChange={(e) => {
                                            const newVal = e.target.value as 'BNB' | 'USDT';
                                            setSwapFrom(newVal);
                                            setSwapTo(newVal === 'BNB' ? 'USDT' : 'BNB');
                                        }}
                                        className="bg-dark-950 border border-gray-700 rounded-lg px-3 py-1 text-white font-bold outline-none focus:border-purple-500"
                                    >
                                        <option value="BNB">BNB</option>
                                        <option value="USDT">USDT</option>
                                    </select>
                               </div>
                           </div>

                           <div className="flex justify-center -my-3 relative z-10">
                               <button 
                                    type="button"
                                    onClick={() => {
                                        setSwapFrom(swapTo);
                                        setSwapTo(swapFrom);
                                    }}
                                    className="bg-dark-950 border border-gray-700 p-2 rounded-full text-purple-400 hover:text-white hover:border-purple-500 transition-colors"
                               >
                                   <RepeatIcon className="w-5 h-5 rotate-90" />
                               </button>
                           </div>

                           <div className="bg-dark-950 p-4 rounded-xl border border-gray-800">
                               <div className="flex justify-between items-center mb-2">
                                   <span className="text-xs text-gray-500 font-bold uppercase">Bạn nhận (ước tính)</span>
                               </div>
                               <div className="flex gap-4 justify-between items-center">
                                    <div className={`text-2xl font-bold font-mono transition-opacity ${isQuoting ? 'opacity-50' : 'text-white'}`}>
                                        {isQuoting ? 'Đang tính...' : swapOutput}
                                    </div>
                                    <div className="bg-dark-900 border border-gray-700 rounded-lg px-3 py-1 text-white font-bold opacity-80 cursor-default">
                                        {swapTo}
                                    </div>
                               </div>
                           </div>

                           <div className="flex justify-between items-center text-xs text-gray-500 px-2">
                               <span>Nhà cung cấp</span>
                               <span className="flex items-center gap-1 text-brand-300">
                                   <img src="https://pancakeswap.finance/logo.png" className="w-4 h-4 rounded-full bg-white" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                   PancakeSwap V2 (Realtime)
                               </span>
                           </div>

                           {swapStatus && (
                               <div className="text-xs text-orange-400 text-center animate-pulse">
                                   {swapStatus}
                               </div>
                           )}

                           <button 
                              type="submit"
                              disabled={isSwapping || !swapAmount || parseFloat(swapAmount) <= 0}
                              className={`w-full py-4 rounded-xl text-base font-bold text-white transition-all transform hover:scale-[1.02] ${
                                  isSwapping 
                                  ? 'bg-gray-800 cursor-not-allowed' 
                                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/20'
                              }`}
                          >
                              {isSwapping ? 'Đang xử lý...' : 'Hoán Đổi Ngay'}
                          </button>
                       </form>
                   )}
                </div>
            </div>

            <div className="bg-dark-900 rounded-xl border border-gray-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                    <h3 className="font-semibold text-white">Lịch sử giao dịch</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-dark-950 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="px-6 py-4">Loại</th>
                                <th className="px-6 py-4">Số tiền</th>
                                <th className="px-6 py-4">Trạng thái</th>
                                <th className="px-6 py-4">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-dark-800/50">
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            tx.status === 'PROCESSING' ? 'bg-orange-400/10 text-orange-400' :
                                            tx.type === 'DEPOSIT' ? 'bg-green-400/10 text-green-400' : 
                                            tx.type === 'WITHDRAW' ? 'bg-orange-400/10 text-orange-400' : 'bg-blue-400/10 text-blue-400'
                                        }`}>
                                            {tx.status === 'PROCESSING' ? 'Pending...' : tx.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold text-white">${tx.amount.toLocaleString()}</td>
                                    <td className={`px-6 py-4 ${tx.status === 'PROCESSING' ? 'text-orange-400' : tx.status === 'COMPLETED' ? 'text-green-400' : 'text-gray-400'}`}>
                                        {tx.status === 'PROCESSING' ? (
                                            <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                                                Pending...
                                            </span>
                                        ) : tx.status}
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">{new Date(tx.date).toLocaleDateString()}</td>
                                </tr>
                            ))}
                             {transactions.length === 0 && (
                                <tr><td colSpan={4} className="p-6 text-center text-gray-500">Chưa có giao dịch</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const MarketView = () => {
      const [coins, setCoins] = useState<CoinData[]>([]);
      const [isLoading, setIsLoading] = useState(true);
      const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

      const fetchMarketData = async () => {
          try {
              const timestamp = Date.now();
              const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true&_t=${timestamp}`);
              const data = await res.json();
              if (Array.isArray(data)) {
                  setCoins(data);
                  setLastUpdated(new Date());
              }
          } catch (error) {
              console.error("CoinGecko API Error:", error);
          } finally {
              setIsLoading(false);
          }
      };

      useEffect(() => {
          fetchMarketData();
          const interval = setInterval(fetchMarketData, 60000);
          return () => clearInterval(interval);
      }, []);

      if (isLoading && coins.length === 0) return <div className="text-center p-8 text-gray-400">Đang tải dữ liệu thị trường...</div>;

      return (
          <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Thị Trường Crypto</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Top 20 tài sản theo vốn hóa thị trường. Tự động cập nhật sau mỗi 60 giây.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded-lg border border-green-900/50">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Realtime Data
                    </div>
                    {lastUpdated && (
                        <span className="text-xs text-gray-500">Cập nhật: {lastUpdated.toLocaleTimeString()}</span>
                    )}
                </div>
              </div>

              <div className="bg-dark-900 rounded-xl border border-gray-800 overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-dark-950 text-gray-400 text-xs uppercase font-medium">
                              <tr>
                                  <th className="px-6 py-4">Tài sản</th>
                                  <th className="px-6 py-4">Giá (USD)</th>
                                  <th className="px-6 py-4">Biến động 24h</th>
                                  <th className="px-6 py-4">Vốn hóa</th>
                                  <th className="px-6 py-4">Xu hướng 7 ngày</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                              {coins.map((coin) => {
                                  const isPositive = coin.price_change_percentage_24h >= 0;
                                  // Data for sparkline
                                  const chartData = coin.sparkline_in_7d.price.map((p, i) => ({ i, p }));
                                  const minPrice = Math.min(...coin.sparkline_in_7d.price);
                                  const maxPrice = Math.max(...coin.sparkline_in_7d.price);

                                  return (
                                      <tr key={coin.id} className="hover:bg-dark-800/50 transition-colors">
                                          <td className="px-6 py-4">
                                              <div className="flex items-center gap-3">
                                                  <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                                                  <div>
                                                      <div className="font-bold text-white">{coin.symbol.toUpperCase()}</div>
                                                      <div className="text-xs text-gray-500">{coin.name}</div>
                                                  </div>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4 font-mono font-medium text-white">
                                              ${coin.current_price.toLocaleString()}
                                          </td>
                                          <td className={`px-6 py-4 font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                              <div className="flex items-center gap-1">
                                                  {isPositive ? <TrendingUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                                                  {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
                                              </div>
                                          </td>
                                          <td className="px-6 py-4 text-gray-400 text-sm">
                                              ${(coin.market_cap / 1e9).toFixed(2)}B
                                          </td>
                                          <td className="px-6 py-2 w-[200px]">
                                              <div className="h-[60px] w-[160px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartData}>
                                                        <defs>
                                                            <linearGradient id={`gradient-${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={isPositive ? "#4ade80" : "#f87171"} stopOpacity={0.3}/>
                                                                <stop offset="95%" stopColor={isPositive ? "#4ade80" : "#f87171"} stopOpacity={0}/>
                                                            </linearGradient>
                                                        </defs>
                                                        <YAxis hide domain={[minPrice, maxPrice]} />
                                                        <Area 
                                                            type="monotone" 
                                                            dataKey="p" 
                                                            stroke={isPositive ? "#4ade80" : "#f87171"} 
                                                            strokeWidth={2} 
                                                            fill={`url(#gradient-${coin.id})`}
                                                            isAnimationActive={false}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                              </div>
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  const SystemView = () => {
    // Nếu referrals là null hoặc undefined, dùng mảng rỗng để tránh crash
    const safeReferrals = referrals || [];
    
    // Tính toán thống kê từ dữ liệu thật
    const totalRef = safeReferrals.length;
    // Giả sử mỗi ref mang lại doanh số ngẫu nhiên hoặc tính từ balance của họ (nếu có quyền xem)
    // Ở đây ta tạm tính tổng số dư của F1 coi như doanh số
    const totalVolume = safeReferrals.reduce((acc, curr) => acc + curr.balance, 0);
    const totalCommission = totalVolume * 0.01; // Giả sử hoa hồng 1%

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Hệ Thống Partner</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-dark-900 p-6 rounded-xl border border-gray-800">
                     <div className="text-gray-400 text-sm mb-1">Tổng thành viên (F1)</div>
                     <div className="text-3xl font-bold text-white">{totalRef}</div>
                 </div>
                 <div className="bg-dark-900 p-6 rounded-xl border border-gray-800">
                     <div className="text-gray-400 text-sm mb-1">Tổng doanh số Team</div>
                     <div className="text-3xl font-bold text-brand-400">${totalVolume.toLocaleString()}</div>
                 </div>
                 <div className="bg-dark-900 p-6 rounded-xl border border-gray-800">
                     <div className="text-gray-400 text-sm mb-1">Hoa hồng ước tính</div>
                     <div className="text-3xl font-bold text-green-400">${totalCommission.toLocaleString()}</div>
                 </div>
            </div>

            <div className="bg-dark-900 p-6 rounded-xl border border-gray-800">
                <h3 className="font-semibold text-white mb-4">Link giới thiệu của bạn</h3>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        readOnly 
                        value={`${window.location.origin}/?ref=${user.id}`}
                        className="flex-1 bg-dark-950 border border-gray-700 rounded-lg px-4 py-2 text-gray-300 font-mono text-sm"
                    />
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/?ref=${user.id}`);
                            alert("Đã copy link!");
                        }}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
                    >
                        <CopyIcon className="w-4 h-4" /> Copy
                    </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                    * Lưu ý: Chia sẻ link này cho bạn bè. Khi họ đăng ký, họ sẽ trở thành F1 của bạn.
                </p>
            </div>

            <div className="bg-dark-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-white">Danh sách thành viên (F1)</h3>
                        <button 
                            onClick={handleManualRefresh} 
                            disabled={isRefreshingRefs}
                            className="text-xs text-brand-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                            <RepeatIcon className={`w-3 h-3 ${isRefreshingRefs ? 'animate-spin' : ''}`} /> 
                            {isRefreshingRefs ? 'Đang tải...' : 'Làm mới'}
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-dark-950 text-gray-400 uppercase text-xs font-medium">
                            <tr>
                                <th className="px-6 py-4">Họ tên / Email</th>
                                <th className="px-6 py-4">Ngày tham gia</th>
                                <th className="px-6 py-4">Ví liên kết</th>
                                <th className="px-6 py-4">Tổng đầu tư</th>
                                <th className="px-6 py-4">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {safeReferrals.length > 0 ? (
                                safeReferrals.map((ref) => (
                                    <tr key={ref.id} className="hover:bg-dark-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                 <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                                                    {ref.name ? ref.name.charAt(0) : 'U'}
                                                 </div>
                                                 <div className="flex flex-col">
                                                     <span className="text-sm font-medium text-white">{ref.name}</span>
                                                     <span className="text-xs text-gray-500">{ref.email}</span>
                                                 </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">
                                            {ref.joinedDate ? new Date(ref.joinedDate).toLocaleDateString('vi-VN') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono text-gray-400">
                                            {ref.walletAddress ? 
                                                <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded text-xs">{ref.walletAddress.slice(0,6)}...{ref.walletAddress.slice(-4)}</span> 
                                                : <span className="text-gray-600 text-xs italic">Chưa kết nối</span>}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-brand-400">${ref.balance.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded text-xs font-semibold border border-green-400/20">Active</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <UsersIcon className="w-10 h-10 text-gray-700" />
                                            <p>Chưa có thành viên nào.</p>
                                            <p className="text-xs">Hãy chia sẻ link giới thiệu ngay để xây dựng đội nhóm!</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const ReportView = () => (
      <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white mb-4">Báo Cáo Hiệu Suất</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-dark-900 p-6 rounded-xl border border-gray-800">
                  <h3 className="font-semibold text-white mb-4">Lợi nhuận theo thời gian</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                            { name: 'Ngày', val: user.balance * (config.interestRatePercent/30/100) },
                            { name: 'Tuần', val: user.balance * (config.interestRatePercent/4/100) },
                            { name: 'Tháng', val: user.balance * (config.interestRatePercent/100) },
                            { name: 'Quý', val: user.balance * (config.interestRatePercent*3/100) },
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                            <Bar dataKey="val" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
              </div>
              <div className="space-y-4">
                  <div className="bg-dark-900 p-6 rounded-xl border border-gray-800 flex justify-between items-center">
                      <span className="text-gray-400">Lợi nhuận hôm nay</span>
                      <span className="text-xl font-bold text-green-400">+${(user.balance * (config.interestRatePercent/30/100)).toFixed(2)}</span>
                  </div>
                  <div className="bg-dark-900 p-6 rounded-xl border border-gray-800 flex justify-between items-center">
                      <span className="text-gray-400">Dự kiến tháng này</span>
                      <span className="text-xl font-bold text-brand-400">+${(user.balance * (config.interestRatePercent/100)).toFixed(2)}</span>
                  </div>
              </div>
          </div>
      </div>
  );

  const SettingsView = () => (
    <div className="space-y-6 max-w-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">Cài Đặt Tài Khoản</h2>
        
        <div className="bg-dark-900 p-6 rounded-xl border border-gray-800 space-y-4">
            <h3 className="font-semibold text-white border-b border-gray-800 pb-2">Thông tin cá nhân</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Họ tên</label>
                    <input type="text" value={user.name} disabled className="w-full bg-dark-950 border border-gray-700 rounded p-2 text-gray-400 cursor-not-allowed" />
                </div>
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Email</label>
                    <input type="text" value={user.email} disabled className="w-full bg-dark-950 border border-gray-700 rounded p-2 text-gray-400 cursor-not-allowed" />
                </div>
            </div>
        </div>

        <div className="bg-dark-900 p-6 rounded-xl border border-gray-800 space-y-4">
            <h3 className="font-semibold text-white border-b border-gray-800 pb-2">Bảo mật</h3>
            
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-medium text-white">Xác thực 2 lớp (2FA)</div>
                    <div className="text-sm text-gray-400">Bảo vệ tài khoản bằng Google Authenticator</div>
                </div>
                <div>
                    {mfaEnabled ? (
                        <button 
                            onClick={handleDisableMFA}
                            disabled={isLoadingSettings}
                            className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoadingSettings && <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>}
                            Tắt xác thực
                        </button>
                    ) : (
                        <button 
                            onClick={handleStartMFA}
                            disabled={isLoadingSettings}
                            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-500 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoadingSettings && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                            Kích hoạt
                        </button>
                    )}
                </div>
            </div>

            {isEnrollingMfa && mfaQR && (
                <div className="mt-4 p-4 bg-dark-950 rounded-xl border border-gray-700 animate-fadeIn">
                    <p className="text-sm text-gray-300 mb-4">
                        1. Quét mã QR này bằng ứng dụng Authenticator của bạn (Google Auth, Authy).
                    </p>
                    <div className="flex justify-center mb-4 bg-white p-2 rounded w-fit mx-auto">
                        <img src={mfaQR} alt="QR Code" className="w-48 h-48" />
                    </div>
                    <p className="text-sm text-gray-300 mb-2">
                        2. Nhập mã 6 số từ ứng dụng để xác nhận:
                    </p>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 bg-dark-800 border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-brand-500"
                            placeholder="000000"
                            maxLength={6}
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                        />
                        <button 
                            onClick={handleVerifyMFA}
                            disabled={isLoadingSettings}
                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoadingSettings && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                            Xác nhận
                        </button>
                    </div>
                    <button 
                        onClick={() => setIsEnrollingMfa(false)}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-300 underline"
                    >
                        Hủy bỏ
                    </button>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-950 flex font-sans text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-900 border-r border-gray-800 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2 text-brand-500 font-bold text-xl">
             <TrendingUpIcon /> WEB2 PRO
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-dark-800 hover:text-white'}`}
          >
            <LayoutDashboardIcon className="w-5 h-5" /> Tổng Quan
          </button>
          
          <button 
            onClick={() => setActiveTab('wallet')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'wallet' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-dark-800 hover:text-white'}`}
          >
            <WalletIcon className="w-5 h-5" /> Ví Cá Nhân
          </button>

          <button 
            onClick={() => setActiveTab('market')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'market' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-dark-800 hover:text-white'}`}
          >
            <GlobeIcon className="w-5 h-5" /> Thị Trường
          </button>

          <button 
            onClick={() => setActiveTab('system')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'system' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-dark-800 hover:text-white'}`}
          >
            <UsersIcon className="w-5 h-5" /> Hệ Thống
          </button>

          <button 
            onClick={() => setActiveTab('report')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'report' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-dark-800 hover:text-white'}`}
          >
            <BarChartIcon className="w-5 h-5" /> Báo Cáo
          </button>

           <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-dark-800 hover:text-white'}`}
          >
            <SettingsIcon className="w-5 h-5" /> Cài Đặt
          </button>

          {/* Admin Navigation Button */}
          {user.role === UserRole.ADMIN && (
              <div className="pt-4 mt-2 border-t border-gray-800">
                   <button 
                        onClick={onNavigateToAdmin}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors border border-red-400/20"
                    >
                        <SettingsIcon className="w-5 h-5" /> Trang Quản Trị
                    </button>
              </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOutIcon className="w-5 h-5" /> Đăng Xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-dark-900 p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 z-20">
            <span className="font-bold text-brand-500">WEB2 PRO</span>
            <div className="flex items-center gap-2">
                {user.role === UserRole.ADMIN && (
                    <button onClick={onNavigateToAdmin} className="text-red-400"><SettingsIcon /></button>
                )}
                <button onClick={onLogout} className="text-gray-400"><LogOutIcon /></button>
            </div>
        </div>
        
        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex overflow-x-auto bg-dark-900 border-b border-gray-800 p-2 gap-2 sticky top-14 z-20">
             {['dashboard', 'wallet', 'market', 'system', 'report', 'settings'].map((tab) => (
                 <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as TabType)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === tab ? 'bg-brand-600 text-white' : 'bg-dark-800 text-gray-400'}`}
                 >
                    {tab === 'dashboard' ? 'Tổng quan' : tab === 'wallet' ? 'Ví' : tab === 'market' ? 'Thị trường' : tab === 'system' ? 'Hệ thống' : tab === 'report' ? 'Báo cáo' : 'Cài đặt'}
                 </button>
             ))}
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <Overview />}
          {activeTab === 'wallet' && <WalletView />}
          {activeTab === 'market' && <MarketView />}
          {activeTab === 'system' && <SystemView />}
          {activeTab === 'report' && <ReportView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
