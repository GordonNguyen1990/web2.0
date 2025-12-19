
import React, { useState, useEffect } from 'react';
import { SystemConfig, User, UserRole } from '../types';
import { LayoutDashboardIcon, UsersIcon, SettingsIcon, LogOutIcon, ArrowRight, XIcon, CheckCircle } from './Icons';

interface AdminPanelProps {
  config: SystemConfig;
  users: User[];
  onUpdateConfig: (newConfig: SystemConfig) => void;
  onLogout: () => void;
  onNavigateToDashboard?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ config, users, onUpdateConfig, onLogout, onNavigateToDashboard }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'withdrawals' | 'users' | 'settings'>('dashboard');
  
  // Settings State
  const [interestRate, setInterestRate] = useState(config.interestRatePercent);
  const [withdrawalFee, setWithdrawalFee] = useState(config.withdrawalFeePercent);
  const [message, setMessage] = useState('');

  // Withdrawals State
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Auto-refresh withdrawals
  useEffect(() => {
      fetchPendingWithdrawals();
      const interval = setInterval(fetchPendingWithdrawals, 30000); // Refresh every 30s
      return () => clearInterval(interval);
  }, []);

  const fetchPendingWithdrawals = async () => {
      setIsLoadingWithdrawals(true);
      try {
          const adminId = users.find(u => u.role === UserRole.ADMIN)?.id || 'admin';
          const res = await fetch('/.netlify/functions/get_pending_withdrawals', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ admin_id: adminId }) 
          });
          if (res.ok) {
              const data = await res.json();
              setPendingWithdrawals(data.transactions || []);
          }
      } catch (e) {
          console.error("Error fetching withdrawals", e);
      } finally {
          setIsLoadingWithdrawals(false);
      }
  };

  const handleProcessWithdrawal = async (txId: string, action: 'APPROVE' | 'REJECT') => {
      const confirmMsg = action === 'APPROVE' 
        ? "Bạn có chắc chắn muốn DUYỆT yêu cầu này? Tiền sẽ được chuyển ngay." 
        : "Bạn có chắc chắn muốn TỪ CHỐI? Tiền sẽ được hoàn lại vào tài khoản user.";
      
      if (!window.confirm(confirmMsg)) return;
      
      setProcessingId(txId);
      try {
          const res = await fetch('/.netlify/functions/approve_withdrawal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  transaction_id: txId,
                  admin_id: users.find(u => u.role === UserRole.ADMIN)?.id,
                  action: action
              })
          });
          const data = await res.json();
          
          if (data.error) throw new Error(data.error);
          
          if (action === 'APPROVE') {
            alert("Đã duyệt! Payout ID: " + (data.payout_data?.id || 'Manual'));
          } else {
            alert("Đã từ chối và hoàn tiền thành công.");
          }
          
          fetchPendingWithdrawals(); // Reload list
      } catch (err: any) {
          alert(`Lỗi xử lý (${action}): ` + err.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleSaveConfig = () => {
    onUpdateConfig({
      interestRatePercent: Number(interestRate),
      withdrawalFeePercent: Number(withdrawalFee),
    });
    setMessage('Cập nhật thành công!');
    setTimeout(() => setMessage(''), 3000);
  };

  const TabButton = ({ id, label, icon: Icon }: any) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${
            activeTab === id 
            ? 'bg-brand-500 text-white font-bold shadow-lg shadow-brand-500/20' 
            : 'text-gray-400 hover:bg-dark-800 hover:text-white'
        }`}
      >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
      </button>
  );

  return (
    <div className="min-h-screen bg-dark-950 flex font-sans">
      
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-800 bg-dark-900 hidden md:flex flex-col p-6">
          <div className="mb-10 flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center font-bold text-white">A</div>
              <span className="text-xl font-bold text-white">Admin Panel</span>
          </div>

          <div className="space-y-2 flex-1">
              <TabButton id="dashboard" label="Tổng Quan" icon={LayoutDashboardIcon} />
              <TabButton id="withdrawals" label="Rút Tiền" icon={ArrowRight} />
              <TabButton id="users" label="Thành Viên" icon={UsersIcon} />
              <TabButton id="settings" label="Cài Đặt" icon={SettingsIcon} />
          </div>

          <div className="pt-6 border-t border-gray-800">
             <button 
                onClick={onNavigateToDashboard}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors"
             >
                 &larr; Về Website
             </button>
             <button 
                onClick={onLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:text-red-300 transition-colors mt-2"
             >
                 <LogOutIcon className="w-4 h-4" /> Đăng xuất
             </button>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
          {/* Header Mobile */}
          <div className="md:hidden flex justify-between items-center mb-8">
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
              <button onClick={onLogout} className="text-red-400 text-sm">Thoát</button>
          </div>

          {/* Tab Content */}
          <div className="max-w-5xl mx-auto">
              
              {activeTab === 'dashboard' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                      <div className="bg-dark-900 p-6 rounded-2xl border border-gray-800">
                          <h3 className="text-gray-400 text-sm font-medium mb-2">Tổng Thành Viên</h3>
                          <div className="text-3xl font-bold text-white">{users.length}</div>
                      </div>
                      <div className="bg-dark-900 p-6 rounded-2xl border border-gray-800">
                          <h3 className="text-gray-400 text-sm font-medium mb-2">Yêu Cầu Rút Tiền</h3>
                          <div className="text-3xl font-bold text-orange-400">{pendingWithdrawals.length}</div>
                          <div className="text-xs text-gray-500 mt-1">Đang chờ xử lý</div>
                      </div>
                      <div className="bg-dark-900 p-6 rounded-2xl border border-gray-800">
                          <h3 className="text-gray-400 text-sm font-medium mb-2">Tổng Nạp (Demo)</h3>
                          <div className="text-3xl font-bold text-green-400">$24,500</div>
                      </div>
                  </div>
              )}

              {activeTab === 'withdrawals' && (
                  <div className="bg-dark-900 rounded-2xl border border-gray-800 overflow-hidden animate-fade-in">
                      <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                          <h2 className="text-lg font-bold text-white">Yêu cầu rút tiền</h2>
                          <button onClick={fetchPendingWithdrawals} className="text-brand-400 text-sm hover:underline">Làm mới</button>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left">
                              <thead className="bg-dark-950 text-gray-500 text-xs uppercase">
                                  <tr>
                                      <th className="px-6 py-4">User</th>
                                      <th className="px-6 py-4">Số tiền</th>
                                      <th className="px-6 py-4">Ví nhận</th>
                                      <th className="px-6 py-4">Trạng thái</th>
                                      <th className="px-6 py-4 text-right">Hành động</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800">
                                  {pendingWithdrawals.map((tx) => (
                                      <tr key={tx.id} className="hover:bg-dark-800/50">
                                          <td className="px-6 py-4">
                                              <div className="text-sm font-medium text-white">{tx.profiles?.full_name || 'Unknown'}</div>
                                              <div className="text-xs text-gray-500">{tx.profiles?.email || tx.user_id}</div>
                                          </td>
                                          <td className="px-6 py-4 font-mono font-bold text-orange-400">
                                              ${tx.amount.toLocaleString()}
                                          </td>
                                          <td className="px-6 py-4">
                                              <div className="text-xs font-mono bg-dark-950 px-2 py-1 rounded border border-gray-800 inline-block max-w-[150px] truncate">
                                                  {tx.metadata?.wallet_address || tx.description}
                                              </div>
                                          </td>
                                          <td className="px-6 py-4">
                                              <span className={`px-2 py-1 rounded text-xs font-bold ${tx.status === 'PROCESSING' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                  {tx.status}
                                              </span>
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              {tx.status === 'PENDING' && (
                                                  <div className="flex items-center justify-end gap-2">
                                                      <button 
                                                          onClick={() => handleProcessWithdrawal(tx.id, 'APPROVE')}
                                                          disabled={!!processingId}
                                                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500 hover:text-white transition-all disabled:opacity-50"
                                                          title="Duyệt"
                                                      >
                                                          <CheckCircle className="w-4 h-4" />
                                                      </button>
                                                      <button 
                                                          onClick={() => handleProcessWithdrawal(tx.id, 'REJECT')}
                                                          disabled={!!processingId}
                                                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                                          title="Từ chối"
                                                      >
                                                          <XIcon className="w-4 h-4" />
                                                      </button>
                                                  </div>
                                              )}
                                              {tx.status === 'PROCESSING' && (
                                                  <span className="text-xs text-gray-500 italic">Đang xử lý...</span>
                                              )}
                                          </td>
                                      </tr>
                                  ))}
                                  {pendingWithdrawals.length === 0 && (
                                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">Không có yêu cầu nào</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {activeTab === 'users' && (
                  <div className="bg-dark-900 rounded-2xl border border-gray-800 overflow-hidden animate-fade-in">
                      <div className="p-6 border-b border-gray-800">
                          <h2 className="text-lg font-bold text-white">Danh sách thành viên</h2>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-dark-950 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-4">Thành viên</th>
                                    <th className="px-6 py-4">Ngày tham gia</th>
                                    <th className="px-6 py-4">Số dư</th>
                                    <th className="px-6 py-4">Vai trò</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {users.map(user => (
                                    <tr key={user.id} className="hover:bg-dark-800/50">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-white">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            {new Date(user.joinedDate || Date.now()).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-green-400">
                                            ${user.balance.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${user.role === UserRole.ADMIN ? 'bg-red-500/20 text-red-400' : 'bg-gray-700/50 text-gray-300'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      </div>
                  </div>
              )}

              {activeTab === 'settings' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                      <div className="bg-dark-900 p-6 rounded-2xl border border-gray-800">
                          <h3 className="text-lg font-bold text-white mb-4">Cấu hình Lãi suất</h3>
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-gray-400 text-sm mb-2">Lãi suất tháng (%)</label>
                                  <input 
                                    type="number" 
                                    value={interestRate}
                                    onChange={(e) => setInterestRate(Number(e.target.value))}
                                    className="w-full bg-dark-950 border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-brand-500 outline-none"
                                  />
                              </div>
                          </div>
                      </div>
                      <div className="bg-dark-900 p-6 rounded-2xl border border-gray-800">
                          <h3 className="text-lg font-bold text-white mb-4">Phí giao dịch</h3>
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-gray-400 text-sm mb-2">Phí rút tiền (%)</label>
                                  <input 
                                    type="number" 
                                    value={withdrawalFee}
                                    onChange={(e) => setWithdrawalFee(Number(e.target.value))}
                                    className="w-full bg-dark-950 border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-brand-500 outline-none"
                                  />
                              </div>
                          </div>
                      </div>
                      <div className="md:col-span-2">
                          <button 
                            onClick={handleSaveConfig}
                            className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-brand-500/20"
                          >
                              Lưu Cấu Hình
                          </button>
                          {message && <span className="ml-4 text-green-400">{message}</span>}
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default AdminPanel;
