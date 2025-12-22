
import { supabase } from './supabaseClient';
import { SystemConfig } from '../types';

export const getSystemConfig = async (): Promise<SystemConfig | null> => {
    try {
        const { data, error } = await supabase
            .from('system_config')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.warn("Could not fetch system config (table might not exist yet):", error.message);
            return null;
        }

        if (data) {
            return {
                interestRatePercent: Number(data.interest_rate_percent),
                withdrawalFeePercent: Number(data.withdrawal_fee_percent)
            };
        }
        return null;
    } catch (err) {
        console.error("Error fetching config:", err);
        return null;
    }
};

export const updateSystemConfig = async (config: SystemConfig): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('system_config')
            .update({
                interest_rate_percent: config.interestRatePercent,
                withdrawal_fee_percent: config.withdrawalFeePercent
            })
            .eq('id', 1);

        if (error) {
            console.error("Error updating config:", error);
            throw error;
        }
        return true;
    } catch (err) {
        console.error("Failed to update config:", err);
        return false;
    }
};
