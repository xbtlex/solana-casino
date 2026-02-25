/**
 * Enhanced sound effects using Web Audio API
 */

class SoundEffects {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Play a big win sound - triumphant fanfare
   */
  playBigWin() {
    try {
      const ctx = this.getContext();

      // Create multiple oscillators for a richer sound
      for (let i = 0; i < 3; i++) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        const baseFreq = 400 + i * 200;
        oscillator.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 2, ctx.currentTime + 0.15);
        oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 3, ctx.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        oscillator.start(ctx.currentTime + i * 0.05);
        oscillator.stop(ctx.currentTime + 0.5);
      }
    } catch (error) {
      console.warn('Failed to play big win sound:', error);
    }
  }

  /**
   * Play a win sound - upward chirp
   */
  playWin() {
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(400, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.warn('Failed to play win sound:', error);
    }
  }

  /**
   * Play a lose sound - downward tone
   */
  playLose() {
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(400, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.warn('Failed to play lose sound:', error);
    }
  }

  /**
   * Play a coin flip sound - multiple quick beeps
   */
  playFlip() {
    try {
      const ctx = this.getContext();

      for (let i = 0; i < 5; i++) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600 + i * 100, ctx.currentTime + i * 0.05);

        gainNode.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.05);

        oscillator.start(ctx.currentTime + i * 0.05);
        oscillator.stop(ctx.currentTime + i * 0.05 + 0.05);
      }
    } catch (error) {
      console.warn('Failed to play flip sound:', error);
    }
  }

  /**
   * Play a click sound
   */
  playClick() {
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(1000, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.05);
    } catch (error) {
      console.warn('Failed to play click sound:', error);
    }
  }

  /**
   * Play a hover sound - subtle beep
   */
  playHover() {
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(800, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.03);
    } catch (error) {
      console.warn('Failed to play hover sound:', error);
    }
  }

  /**
   * Play a payout sent sound
   */
  playPayoutSent() {
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(500, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.warn('Failed to play payout sound:', error);
    }
  }
}

export const soundEffects = new SoundEffects();
