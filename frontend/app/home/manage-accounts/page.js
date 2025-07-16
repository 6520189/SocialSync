'use client';

import { useEffect, useState } from 'react';
import SocialAccountCard from '../../components/SocialAccountCard';
import DisconnectModal from '../../components/DisconnectModal'; // Updated import statement
import { SiMastodon } from 'react-icons/si';

import {
  FaFacebook,
  FaInstagram,
  FaYoutube,
  FaTiktok,
  FaTwitter,
  FaTelegram, // Added FaTelegram
} from 'react-icons/fa';
import { FaSquareThreads } from 'react-icons/fa6'; // Added FaSquareThreads
import axios from 'axios';

export default function ManageAccountPage() {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('success');

  // Modal specific state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [platformToDisconnect, setPlatformToDisconnect] = useState(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramLoading, setTelegramLoading] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  // Map backend platform keys to frontend display names
  // Reordered to move TikTok to the end
  const backendToDisplayName = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    twitter: 'Twitter (X)',
    mastodon: 'Mastodon',
    threads: 'Threads',
    telegram: 'Telegram',
    tiktok: 'TikTok', // Moved to the end
  };

  // List of platforms to display, reordered for TikTok
  const platformsList = [
    'facebook',
    'instagram',
    'youtube',
    'twitter',
    'mastodon',
    'threads',
    'telegram',
    'tiktok', // Moved to the end
  ];


  // Return the appropriate icon component based on display name
  const getIcon = (platform) => {
    switch (platform) {
      case 'Facebook':
        return FaFacebook;
      case 'Instagram':
        return FaInstagram;
      case 'YouTube':
        return FaYoutube;
      case 'TikTok':
        return FaTiktok;
      case 'Twitter (X)':
        return FaTwitter;
      case 'Mastodon':
        return SiMastodon;
      case 'Threads': // Added Threads
        return FaSquareThreads;
      case 'Telegram': // Added Telegram
        return FaTelegram;
      default:
        return null;
    }
  };

  const fetchAccounts = async () => {
    if (!token) {
      setError('Access token not found.');
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get('http://localhost:8080/api/social-accounts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const accounts = Array.isArray(res.data) ? res.data : [];

      // Create platform data by mapping backend keys to frontend display names
      const platformData = platformsList.map((backendKey) => { // Iterate over platformsList to maintain order
        const displayName = backendToDisplayName[backendKey];
        const account = accounts.find(
          (acc) => acc?.platform?.toLowerCase() === backendKey
        );

        return {
          name: displayName,
          icon: getIcon(displayName),
          connected: !!account,
          // Defensive check on profilePictureUrl
          userProfilePic:
            account?.profilePictureUrl && account.profilePictureUrl !== 'null'
              ? account.profilePictureUrl
              : null,
          accountName: account?.profileName || '',
        };
      });

      setPlatforms(platformData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch social accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleConnect = async (platformName, isConnected) => {
    if (!token) {
      setStatusMessage('You must be logged in.');
      setStatusType('error');
      return;
    }

    const isFacebookConnected = platforms.find((p) => p.name === 'Facebook')?.connected;

    if (!isConnected) {
      // Logic for connecting (no change here)
      if (platformName === 'Instagram' && !isFacebookConnected) {
        setStatusMessage('Please connect your Facebook Page first before connecting Instagram.');
        setStatusType('error');
        return;
      }

      try {
        if (platformName === 'Facebook') {
          window.location.href = `http://localhost:8080/auth/facebook/login?token=${token}`;
        } else if (platformName === 'Instagram') {
          await axios.post(
            'http://localhost:8080/connect/instagram',
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setStatusMessage('Instagram account connected successfully!');
          setStatusType('success');
          fetchAccounts();
        } else if (platformName === 'YouTube') {
          window.location.href = `http://localhost:8080/auth/youtube/login?token=${token}`;
        } else if (platformName === 'TikTok') {
          window.location.href = `http://localhost:8080/auth/tiktok/login?token=${token}`;
        } else if (platformName === 'Twitter (X)') {
          window.location.href = `http://localhost:8080/auth/twitter/login?token=${token}`;
        } else if (platformName === 'Mastodon') {
          const instance = 'mastodon.social';
          window.location.href = `http://localhost:8080/auth/mastodon/login?instance=${encodeURIComponent(
            instance
          )}&token=${token}`;
        } else if (platformName === 'Threads') {
          window.location.href = `http://localhost:8080/auth/threads/login?token=${token}`;
        } else if (platformName === 'Telegram') {
          setShowTelegramModal(true);
          return;
        } else {
          setStatusMessage(`Connect to ${platformName} is not yet implemented.`);
          setStatusType('error');
        }
      } catch (err) {
        const msg = err?.response?.data?.error || `Failed to connect ${platformName}.`;
        setStatusMessage(msg);
        setStatusType('error');
      }
    } else {
      // Logic for showing confirmation modal before disconnecting
      setPlatformToDisconnect(platformName);
      setShowConfirmModal(true);
    }
  };

  const handleConfirmDisconnect = async () => {
    setShowConfirmModal(false); // Close the modal immediately
    if (!platformToDisconnect) return;

    try {
      await axios.delete(`http://localhost:8080/api/social-accounts/${platformToDisconnect.toLowerCase()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPlatforms((prev) =>
        prev.map((p) =>
          p.name === platformToDisconnect ? { ...p, connected: false, userProfilePic: null, accountName: '' } : p
        )
      );

      setStatusMessage(`${platformToDisconnect} disconnected successfully.`);
      setStatusType('success');
    } catch (err) {
      const msg = err?.response?.data?.error || `Failed to disconnect ${platformToDisconnect}.`;
      setStatusMessage(msg);
      setStatusType('error');
    } finally {
      setPlatformToDisconnect(null); // Clear the platform being disconnected
    }
  };

  const handleCloseConfirmModal = () => {
    setShowConfirmModal(false);
    setPlatformToDisconnect(null); // Clear the platform being disconnected
  };

  // Telegram connect handler
  const handleTelegramConnect = async (e) => {
    e.preventDefault();
    if (!telegramChatId) {
      setStatusMessage('Please enter your Telegram channel username.');
      setStatusType('error');
      return;
    }
    setTelegramLoading(true);
    try {
      await axios.post(
        'http://localhost:8080/connect/telegram',
        { chat_id: telegramChatId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusMessage('Telegram channel connected successfully!');
      setStatusType('success');
      setShowTelegramModal(false);
      setTelegramChatId('');
      fetchAccounts();
    } catch (err) {
      setStatusMessage(
        err?.response?.data?.error || 'Failed to connect Telegram channel.'
      );
      setStatusType('error');
    } finally {
      setTelegramLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center mb-6 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Hello!</h1>
          <p className="text-gray-600">Manage Your Social Media Accounts</p>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            statusType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
          role="alert"
          aria-live="polite"
        >
          {statusMessage}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          <p className="mb-6 text-gray-600">
            Connect or disconnect your accounts to start managing content across platforms.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {platforms.map((platform) => (
              <SocialAccountCard
                key={platform.name}
                platform={platform.name}
                IconComponent={platform.icon}
                connected={platform.connected}
                userProfilePic={platform.userProfilePic}
                accountName={platform.accountName}
                onConnect={() => handleConnect(platform.name, platform.connected)}
              />
            ))}
          </div>
        </>
      )}

      {/* Disconnect Modal */}
      <DisconnectModal
        show={showConfirmModal}
        onClose={handleCloseConfirmModal}
        onConfirm={handleConfirmDisconnect}
        platformName={platformToDisconnect}
      />

      {showTelegramModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Connect Telegram Channel</h2>
            <form onSubmit={handleTelegramConnect} className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Enter your Telegram <span className="font-semibold">channel username</span> (e.g., <span className="text-blue-600">@socialsyncchannel</span>):
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  required
                />
              </label>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
                  onClick={() => setShowTelegramModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  disabled={telegramLoading}
                >
                  {telegramLoading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}