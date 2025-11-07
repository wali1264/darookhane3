import { supabase } from './supabaseClient';
import { ActivityActionType, ActivityEntityType } from '../types';

interface AuthenticatedUser {
  id: number;
  username: string;
  type: 'employee' | 'supplier';
}

/**
 * A centralized function to log significant user activities to the database.
 * It automatically retrieves the current user from session storage.
 *
 * @param actionType The type of action (e.g., 'CREATE', 'UPDATE', 'DELETE').
 * @param entity The type of entity being acted upon (e.g., 'Drug', 'SaleInvoice').
 * @param entityId The ID of the entity.
 * @param details An object containing relevant data about the action (e.g., old/new values, created object).
 */
export async function logActivity(
    actionType: ActivityActionType,
    entity: ActivityEntityType,
    entityId: number | string,
    details: any
) {
    try {
        const storedUserJson = sessionStorage.getItem('shafayar_user_info_for_logger');
        if (!storedUserJson) {
            console.warn("No user found in session for activity logging. Action will not be logged.");
            return;
        }
        const currentUser: AuthenticatedUser = JSON.parse(storedUserJson);

        if (currentUser.type === 'supplier') {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            user_id: Number(currentUser.id),
            username: currentUser.username,
            action_type: actionType,
            entity: entity,
            entity_id: String(entityId),
            details: JSON.parse(JSON.stringify(details)) // Sanitize for non-serializable properties
        };
        
        const { error } = await supabase.from('activity_log').insert(logEntry);
        if (error) {
            console.error("Failed to log activity to Supabase:", error);
        }

    } catch (error) {
        console.error("Failed to prepare or log activity:", error);
    }
}