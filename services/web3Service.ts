
import { BrowserProvider, JsonRpcProvider, Contract, parseUnits, formatUnits } from "ethers";

// Mock type for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

const BSC_CHAIN_ID = 56; // Decimal
const BSC_CHAIN_ID_HEX = '0x38';
// Sử dụng mảng RPC để có dự phòng nếu link chính bị chết
const BSC_RPC_URLS = [
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://bsc-dataseed3.binance.org/'
];
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // USDT BEP20
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'; // WBNB
const PANCAKE_ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // PancakeSwap V2 Router

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

// Khởi tạo Provider tĩnh để tránh độ trễ khi handshake mạng
const getStaticProvider = () => {
    // Dùng URL đầu tiên làm mặc định
    return new JsonRpcProvider(BSC_RPC_URLS[0], {
        name: 'binance',
        chainId: BSC_CHAIN_ID
    });
};

// --- HELPER: Xử lý xung đột ví (Multiple Providers) ---
const getEthereumProvider = () => {
    if (typeof window.ethereum === 'undefined') return null;
    
    // Nếu có nhiều ví (Coinbase, Metamask...) nó sẽ nằm trong mảng providers
    if (Array.isArray(window.ethereum.providers)) {
        // Ưu tiên tìm ví có cờ isMetaMask
        const metamask = window.ethereum.providers.find((p: any) => p.isMetaMask);
        if (metamask) return metamask;
        
        // Nếu không thì lấy cái đầu tiên
        return window.ethereum.providers[0];
    }
    
    // Trường hợp chỉ có 1 ví
    return window.ethereum;
};

export const connectWallet = async (): Promise<string | null> => {
  const provider = getEthereumProvider();
  
  if (!provider) {
    alert("Không tìm thấy ví Metamask! Vui lòng cài đặt extension trên Chrome/Edge hoặc dùng trình duyệt trên điện thoại.");
    return null;
  }

  try {
    // Sử dụng provider đã được lọc (cụ thể là Metamask) để tránh xung đột
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    
    if (!accounts || accounts.length === 0) {
        throw new Error("Không tìm thấy tài khoản nào.");
    }

    // Sau khi kết nối thành công, yêu cầu chuyển mạng ngay lập tức
    await switchToBNBChain();

    return accounts[0];
  } catch (error: any) {
    console.error("Lỗi kết nối Metamask:", error);
    
    // Xử lý các mã lỗi phổ biến
    if (error.code === 4001) {
        alert("Bạn đã từ chối kết nối ví. Vui lòng thử lại và chọn 'Kết nối'.");
    } else if (error.code === -32002) {
        alert("Yêu cầu kết nối đang bị treo ẩn bên dưới hoặc trên thanh Extension. Hãy mở Metamask ra để xác nhận.");
    } else if (error.code === -32603 || error.message?.includes("No active wallet")) {
        alert("Lỗi xung đột ví (-32603): Có thể bạn đang cài nhiều ví (Metamask, Coinbase, Phantom...). Vui lòng tắt bớt các ví khác hoặc mở khóa Metamask trước khi kết nối.");
    } else {
        alert("Lỗi kết nối ví: " + (error.message || "Vui lòng mở Metamask và thử lại"));
    }
    return null;
  }
};

export const switchToBNBChain = async () => {
  const provider = getEthereumProvider();
  if (!provider) return;
  
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID_HEX }],
    });
  } catch (switchError: any) {
    // Mã lỗi 4902 nghĩa là chưa thêm mạng này vào ví
    if (switchError.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: BSC_CHAIN_ID_HEX,
              chainName: 'Binance Smart Chain',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: BSC_RPC_URLS, // Cung cấp danh sách RPC dự phòng
              blockExplorerUrls: ['https://bscscan.com/'],
            },
          ],
        });
      } catch (addError) {
        console.error('Lỗi thêm mạng BSC:', addError);
        alert("Không thể thêm mạng BNB Chain. Vui lòng thêm thủ công trong Metamask.");
      }
    } else {
        console.error("Lỗi chuyển mạng:", switchError);
    }
  }
};

// Hàm lấy giá BNB/USDT trực tiếp từ PancakeSwap Pool (Realtime Source of Truth)
const getBNBPriceFromPool = async (): Promise<number> => {
    try {
        const provider = getStaticProvider();
        const router = new Contract(PANCAKE_ROUTER_ADDRESS, ROUTER_ABI, provider);
        const oneBNB = parseUnits("1", 18);
        const amounts = await router.getAmountsOut(oneBNB, [WBNB_ADDRESS, USDT_CONTRACT_ADDRESS]);
        return parseFloat(formatUnits(amounts[1], 18));
    } catch (error) {
        console.warn("Không thể lấy giá BNB từ Pool, fallback giá cứng:", error);
        return 600; // Giá fallback an toàn
    }
};

export const getWalletBalanceUSD = async (address: string): Promise<number> => {
  if (!address) return 0;

  try {
    const provider = getStaticProvider();

    // 1. Lấy số dư BNB (Native)
    const bnbBalanceWei = await provider.getBalance(address);
    const bnbBalance = parseFloat(formatUnits(bnbBalanceWei, 18));

    // 2. Lấy số dư USDT (Token)
    let usdtBalance = 0;
    try {
      const usdtContract = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
      const usdtBalanceWei = await usdtContract.balanceOf(address);
      usdtBalance = parseFloat(formatUnits(usdtBalanceWei, 18));
    } catch (e) {
      console.warn("Không thể đọc số dư USDT");
    }

    // 3. Lấy giá BNB chuẩn từ thị trường (PancakeSwap)
    const bnbPrice = await getBNBPriceFromPool();

    // Tổng hợp
    const totalUSD = (bnbBalance * bnbPrice) + usdtBalance;
    return parseFloat(totalUSD.toFixed(2));
  } catch (error) {
    console.error("Lỗi tính toán số dư ví:", error);
    return 0;
  }
};

// --- PANCAKESWAP REALTIME FUNCTIONS ---

export const getSwapQuote = async (amountIn: string, fromToken: 'BNB' | 'USDT', toToken: 'BNB' | 'USDT'): Promise<string> => {
    if (!amountIn || parseFloat(amountIn) === 0) return '0';
    if (fromToken === toToken) return amountIn;

    try {
        const provider = getStaticProvider();
        const router = new Contract(PANCAKE_ROUTER_ADDRESS, ROUTER_ABI, provider);

        const path = fromToken === 'BNB' 
            ? [WBNB_ADDRESS, USDT_CONTRACT_ADDRESS]
            : [USDT_CONTRACT_ADDRESS, WBNB_ADDRESS];
        
        // Cả BNB và USDT trên BSC đều dùng 18 decimals
        const amountInWei = parseUnits(amountIn, 18);
        
        // Gọi Smart Contract để lấy Output chính xác
        const amounts = await router.getAmountsOut(amountInWei, path);
        
        // amounts[1] là số lượng token nhận được
        const amountOut = formatUnits(amounts[1], 18);
        return amountOut;
    } catch (error) {
        console.error("Lỗi lấy tỷ giá PancakeSwap:", error);
        return '0';
    }
};

export const executeSwap = async (
    amountIn: string, 
    fromToken: 'BNB' | 'USDT', 
    toToken: 'BNB' | 'USDT',
    onStatusChange?: (status: string) => void
): Promise<boolean> => {
    const ethereumProvider = getEthereumProvider();
    if (!ethereumProvider) {
        alert("Vui lòng cài đặt Metamask!");
        return false;
    }
    
    try {
        // Dùng BrowserProvider với provider đã được chọn chính xác
        const provider = new BrowserProvider(ethereumProvider);
        const signer = await provider.getSigner();
        const router = new Contract(PANCAKE_ROUTER_ADDRESS, ROUTER_ABI, signer);
        const userAddress = await signer.getAddress();
        const amountInWei = parseUnits(amountIn, 18);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

        // Lấy Quote lại một lần nữa để đảm bảo tính minAmountOut (Chống trượt giá)
        const amountOutStr = await getSwapQuote(amountIn, fromToken, toToken);
        if (amountOutStr === '0') throw new Error("Không lấy được tỷ giá. Vui lòng thử lại.");
        
        // Slippage 1% (An toàn cho Stable/Major pairs)
        const amountOutMinWei = parseUnits((parseFloat(amountOutStr) * 0.99).toFixed(18), 18);

        if (fromToken === 'BNB') {
            // BNB -> USDT
            if (onStatusChange) onStatusChange("Vui lòng xác nhận giao dịch trên ví...");
            const tx = await router.swapExactETHForTokens(
                amountOutMinWei,
                [WBNB_ADDRESS, USDT_CONTRACT_ADDRESS],
                userAddress,
                deadline,
                { value: amountInWei }
            );
            if (onStatusChange) onStatusChange("Đang chờ Blockchain xác nhận...");
            await tx.wait();
        } else {
            // USDT -> BNB
            if (onStatusChange) onStatusChange("Đang kiểm tra quyền truy cập USDT...");
            const usdtContract = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, signer);
            const allowance = await usdtContract.allowance(userAddress, PANCAKE_ROUTER_ADDRESS);
            
            if (allowance < amountInWei) {
                if (onStatusChange) onStatusChange("Vui lòng cấp quyền (Approve) USDT cho PancakeSwap...");
                const approveTx = await usdtContract.approve(PANCAKE_ROUTER_ADDRESS, amountInWei * 10n);
                if (onStatusChange) onStatusChange("Đang chờ Approve được xác nhận...");
                await approveTx.wait();
            }

            if (onStatusChange) onStatusChange("Vui lòng xác nhận lệnh Swap...");
            const tx = await router.swapExactTokensForETH(
                amountInWei,
                amountOutMinWei,
                [USDT_CONTRACT_ADDRESS, WBNB_ADDRESS],
                userAddress,
                deadline
            );
            if (onStatusChange) onStatusChange("Đang thực thi Swap...");
            await tx.wait();
        }

        return true;
    } catch (error: any) {
        console.error("Lỗi Swap:", error);
        if (error.code === 4001) {
            if (onStatusChange) onStatusChange("Bạn đã hủy giao dịch.");
        } else {
            if (onStatusChange) onStatusChange("Lỗi: " + (error.shortMessage || error.message));
        }
        return false;
    }
};
