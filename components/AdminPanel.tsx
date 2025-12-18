
import React, { useState } from 'react';
import { SystemConfig, User, UserRole } from '../types';

interface AdminPanelProps {
  config: SystemConfig;
  users: User[];
  onUpdateConfig: (newConfig: SystemConfig) => void;
  onLogout: () => void;
  onNavigateToDashboard?: () => void; // New prop
}

const AdminPanel: React.FC<AdminPanelProps> = ({ config, users, onUpdateConfig, onLogout, onNavigateToDashboard }) => {
  const [interestRate, setInterestRate] = useState(config.interestRatePercent);
  const [withdrawalFee, setWithdrawalFee] = useState(config.withdrawalFeePercent);
  const [message, setMessage] = useState('');

  const handleSave = () => {
    onUpdateConfig({
      interestRatePercent: Number(interestRate),
      withdrawalFeePercent: Number(withdrawalFee),
    });
    setMessage('Cập nhật thành công!');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-4 gap-4">
          <div>
              <div className="flex items-center gap-4 mb-2">
                 <button 
                    onClick={onNavigateToDashboard}
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium bg-dark-800 px-3 py-1 rounded-lg"
                 >
                     &larr; Về Dashboard Cá Nhân
                 </button>
              </div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-500">
                Admin Dashboard
              </h1>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition"
          >
            Đăng xuất
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Interest Rate Settings */}
          <div className="bg-dark-900 rounded-xl p-6 border border-gray-800 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-brand-500">Cấu hình Lãi suất</h2>
            <p className="text-gray-400 text-sm mb-6">
              Điều chỉnh lãi suất (%) hàng tháng cho toàn bộ người dùng.
            </p>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Lãi suất tháng (%)</label>
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full bg-dark-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Fee Settings */}
          <div className="bg-dark-900 rounded-xl p-6 border border-gray-800 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-red-500">Cấu hình Phí Rút</h2>
            <p className="text-gray-400 text-sm mb-6">
              Thiết lập phí (%) tự động trừ khi người dùng rút tiền.
            </p>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Phí rút tiền (%)</label>
              <input
                type="number"
                value={withdrawalFee}
                onChange={(e) => setWithdrawalFee(Number(e.target.value))}
                className="w-full bg-dark-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mb-12 flex items-center gap-4">
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
          >
            Lưu thay đổi
          </button>
          {message && <span className="text-green-400 animate-pulse">{message}</span>}
        </div>

        {/* User List Table */}
        <div className="bg-dark-900 rounded-xl border border-gray-800 shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Quản lý người dùng</h2>
                <span className="text-sm text-gray-400">Tổng: {users.length} thành viên</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-dark-950 text-gray-400 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4 font-medium">Họ tên / Email</th>
                            <th className="px-6 py-4 font-medium">Ngày tham gia</th>
                            <th className="px-6 py-4 font-medium">Ví liên kết</th>
                            <th className="px-6 py-4 font-medium">Số dư</th>
                            <th className="px-6 py-4 font-medium">Vai trò</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-dark-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-white">{user.name}</span>
                                        <span className="text-xs text-gray-500">{user.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400">
                                    {user.joinedDate ? new Date(user.joinedDate).toLocaleDateString('vi-VN') : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm font-mono text-gray-400">
                                    {user.walletAddress ? 
                                        <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded text-xs">{user.walletAddress.slice(0,6)}...{user.walletAddress.slice(-4)}</span> 
                                        : 'Chưa kết nối'}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-green-400">${user.balance.toLocaleString('en-US')}</td>
                                <td className="px-6 py-4 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${user.role === UserRole.ADMIN ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {user.role}
                                    </span>
                                </td>
                            </tr>
                        ))}
                         {users.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chưa có người dùng nào</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div className="mt-12 p-6 bg-dark-800 rounded-xl border border-dashed border-gray-700 opacity-75">
            <h3 className="text-lg font-medium text-gray-400 mb-2">Thông tin hệ thống</h3>
            <ul className="text-sm text-gray-500 space-y-1">
                <li>Phiên bản: v2.5.1</li>
                <li>Trạng thái Web3: Đã kết nối</li>
                <li>Hợp đồng thông minh: 0x... (Simulation)</li>
            </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
