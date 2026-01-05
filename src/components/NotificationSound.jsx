import { useEffect } from 'react';

const notificationSounds = {
  incomplete_trade: () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Gentle chime - two soft tones
    [0, 0.15].forEach((delay, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = i === 0 ? 600 : 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.15;
      
      oscillator.start(audioContext.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.4);
      oscillator.stop(audioContext.currentTime + delay + 0.4);
    });
  },
  
  risk_violation: () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 400;
    oscillator.type = 'square';
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    setTimeout(() => {
      oscillator.frequency.value = 300;
    }, 100);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.stop(audioContext.currentTime + 0.5);
  },
  
  goal_achieved: () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    [0, 0.1, 0.2].forEach((delay, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 600 + (i * 200);
      oscillator.type = 'sine';
      gainNode.gain.value = 0.2;
      
      oscillator.start(audioContext.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.3);
      oscillator.stop(audioContext.currentTime + delay + 0.3);
    });
  },
  
  market_outlook: () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Gentle reminder - single soft tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 650;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.15;
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
    oscillator.stop(audioContext.currentTime + 0.35);
  },
  
  daily_reminder: () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Soft ascending chime
    [0, 0.12, 0.24].forEach((delay, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 550 + (i * 100);
      oscillator.type = 'sine';
      gainNode.gain.value = 0.12;
      
      oscillator.start(audioContext.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.3);
      oscillator.stop(audioContext.currentTime + delay + 0.3);
    });
  }
};

export const playNotificationSound = (type) => {
  try {
    const soundFn = notificationSounds[type] || notificationSounds.incomplete_trade;
    soundFn();
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

export default function NotificationSound() {
  return null;
}