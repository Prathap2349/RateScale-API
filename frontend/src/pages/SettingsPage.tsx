import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, Bell, Globe, Clock, Save } from 'lucide-react';
import { Card } from '../components/ui/Card';

export const SettingsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<boolean>(() => {
    return localStorage.getItem('notificationsEnabled') !== 'false';
  });
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem('appLanguage') || 'en';
  });
  const [timezone, setTimezone] = useState<string>(() => {
    return localStorage.getItem('appTimezone') || 'UTC';
  });

  const handleSaveSettings = () => {
    localStorage.setItem('notificationsEnabled', String(notifications));
    localStorage.setItem('appLanguage', language);
    localStorage.setItem('appTimezone', timezone);
    toast.success('Preferences saved successfully!');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">System Settings</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Notifications, language, and timezone preferences
        </p>
      </div>

      <Card className="space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
          <SettingsIcon className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-bold text-zinc-100">General Preferences</h2>
        </div>

        {/* 1. Notifications */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-200">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100">Telemetry Alerts</h3>
              <p className="text-[11px] text-zinc-400">
                Receive real-time notifications when rate limits are exceeded
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {/* 2. Language */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-200">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100">Language</h3>
              <p className="text-[11px] text-zinc-400">
                Interface localization language
              </p>
            </div>
          </div>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none"
          >
            <option value="en">English (US)</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        {/* 3. Timezone */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-200">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100">Timezone</h3>
              <p className="text-[11px] text-zinc-400">
                Timestamp display timezone for metrics
              </p>
            </div>
          </div>

          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none"
          >
            <option value="UTC">UTC</option>
            <option value="EST">EST (Eastern)</option>
            <option value="PST">PST (Pacific)</option>
            <option value="IST">IST (India)</option>
          </select>
        </div>

        <div className="pt-3 border-t border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={handleSaveSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-950 font-semibold text-xs transition-opacity hover:opacity-90 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            Save Settings
          </button>
        </div>
      </Card>
    </div>
  );
};
