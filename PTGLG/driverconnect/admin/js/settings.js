/**
 * Settings Module
 * Handles application settings management
 */

import { supabase } from '../admin.js';
import { showNotification } from './utils.js';
import { loadMapSettings } from './map.js';

// DOM elements
let settingsForm = null;

/**
 * Set settings-related DOM elements
 * @param {Object} elements - DOM elements for settings
 */
export function setSettingsElements(elements) {
    settingsForm = elements.form;
}

/**
 * Load settings from database and populate form
 */
export async function loadSettings() {
    try {
        const { data: settings, error } = await supabase
            .from('app_settings')
            .select('*');

        if (error) throw error;

        settings.forEach(setting => {
            const inputElement = document.getElementById(setting.id);
            if (inputElement) {
                if (setting.type === 'number') {
                    inputElement.value = parseFloat(setting.value);
                } else if (setting.type === 'boolean') {
                    inputElement.checked = (setting.value === 'true');
                } else {
                    inputElement.value = setting.value;
                }
            }
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('Failed to load settings.', 'error');
    }
}

/**
 * Save settings from form to database
 * @param {Event} event - Form submit event
 */
export async function saveSettings(event) {
    event.preventDefault();

    if (!settingsForm) {
        console.error('Settings form not set');
        return;
    }

    const saveButton = settingsForm.querySelector('button[type="submit"]');
    const originalText = saveButton?.textContent || 'Save';
    if (saveButton) {
        saveButton.textContent = 'Saving...';
        saveButton.disabled = true;
    }

    try {
        const settingsToUpdate = [];
        const inputs = settingsForm.querySelectorAll('input, select');

        inputs.forEach(input => {
            let value;
            let type = input.type;
            if (input.type === 'checkbox') {
                value = input.checked ? 'true' : 'false';
                type = 'boolean';
            } else {
                value = input.value;
            }
            settingsToUpdate.push({ id: input.id, value: value, type: type });
        });

        for (const setting of settingsToUpdate) {
            const { error } = await supabase
                .from('app_settings')
                .update({ value: setting.value, updated_at: new Date().toISOString() })
                .eq('id', setting.id);
            if (error) throw error;
        }

        showNotification('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification(`Failed to save settings: ${error.message}`, 'error');
    } finally {
        if (saveButton) {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }
        // Reload map settings if they were updated
        await loadMapSettings();
    }
}
