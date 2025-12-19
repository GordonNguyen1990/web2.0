
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  balance: number;
  walletAddress?: string;
  joinedDate?: string;
  referrerId?: string; // ID of the person who referred this user
  telegramUsername?: string;
  telegramChatId?: string;
}

export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'INTEREST';
  amount: number;
  date: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'PROCESSING';
  fee?: number;
}

export interface SystemConfig {
  withdrawalFeePercent: number;
  interestRatePercent: number; // Monthly interest
}

export enum AppView {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD', // Người dùng nhập email để yêu cầu reset
  UPDATE_PASSWORD = 'UPDATE_PASSWORD', // Người dùng nhập mật khẩu mới sau khi click link email
  MFA_VERIFY = 'MFA_VERIFY', // New View for 2FA input
  DASHBOARD = 'DASHBOARD',
  ADMIN_PANEL = 'ADMIN_PANEL',
}
