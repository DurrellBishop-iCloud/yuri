import { clamp, damp } from '../utils/math.js';

const ROOT_FREQUENCY = 82.41;
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
const MELODY = [0, 2, 4, 5, 4, 2, 1, 3, 5, 7, 4, 2, 0, 1, 2, 4];
const BASS = [0, 0, -5, 0, -7, -7, -5, -2];

export class RideMusic {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.master = null;
    this.filter = null;
    this.delay = null;
    this.feedback = null;
    this.drone = null;
    this.droneGain = null;
    this.noiseBuffer = null;
    this.started = false;
    this.step = 0;
    this.nextNoteTime = 0;
    this.tempoScale = 0.8;
    this.pitchScale = 0.85;
    this.energy = 0;
    this.unlock = this.unlock.bind(this);
  }

  attach(target = window) {
    target.addEventListener('pointerdown', this.unlock, { passive: true });
    target.addEventListener('keydown', this.unlock);
  }

  unlock() {
    if (this.started || !this.settings.music) {
      return;
    }

    this.start();
  }

  start() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }

    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.filter = this.context.createBiquadFilter();
    this.delay = this.context.createDelay(0.45);
    this.feedback = this.context.createGain();
    this.droneGain = this.context.createGain();

    this.master.gain.value = 0;
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.filter.Q.value = 0.55;
    this.delay.delayTime.value = 0.22;
    this.feedback.gain.value = 0.18;
    this.droneGain.gain.value = 0;

    this.filter.connect(this.master);
    this.filter.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.master);
    this.master.connect(this.context.destination);

    this.createDrone();
    this.createNoiseBuffer();

    this.nextNoteTime = this.context.currentTime + 0.08;
    this.started = true;
  }

  createDrone() {
    const low = this.context.createOscillator();
    const high = this.context.createOscillator();
    low.type = 'sine';
    high.type = 'triangle';
    low.frequency.value = ROOT_FREQUENCY * 0.5;
    high.frequency.value = ROOT_FREQUENCY;
    low.connect(this.droneGain);
    high.connect(this.droneGain);
    this.droneGain.connect(this.filter);
    low.start();
    high.start();
    this.drone = { low, high };
  }

  createNoiseBuffer() {
    const sampleCount = Math.floor(this.context.sampleRate * 0.18);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < sampleCount; i += 1) {
      const envelope = 1 - i / sampleCount;
      data[i] = (Math.random() * 2 - 1) * envelope * envelope;
    }

    this.noiseBuffer = buffer;
  }

  update(dt, snapshot, settings) {
    if (!this.started) {
      return;
    }

    const speed = settings.paused ? 0 : snapshot.speed;
    const speedNorm = clamp(speed / 82, 0, 1.5);
    const downhill = clamp(-snapshot.gradient * 2.8, 0, 0.9);
    const uphill = clamp(snapshot.gradient * 2.5, 0, 0.85);
    const targetEnergy = settings.music ? clamp(speedNorm * 0.82 + downhill * 0.28, 0, 1) : 0;
    const targetTempo = settings.paused || !settings.music
      ? 0.08
      : clamp(0.42 + speedNorm * 0.95 + downhill * 0.55 - uphill * 0.35, 0.18, 2.05);
    const targetPitch = settings.paused || !settings.music
      ? 0.44
      : clamp(0.68 + speedNorm * 0.58 + downhill * 0.18 - uphill * 0.2, 0.48, 1.62);

    this.energy = damp(this.energy, targetEnergy, settings.paused ? 1.55 : 3.4, dt);
    this.tempoScale = damp(this.tempoScale, targetTempo, 2.6, dt);
    this.pitchScale = damp(this.pitchScale, targetPitch, 2.1, dt);

    const now = this.context.currentTime;
    const gain = this.energy * 0.34;
    this.master.gain.setTargetAtTime(gain, now, 0.12);
    this.droneGain.gain.setTargetAtTime(this.energy * 0.08, now, 0.16);
    this.filter.frequency.setTargetAtTime(380 + this.energy * 2400, now, 0.1);

    if (this.drone) {
      this.drone.low.frequency.setTargetAtTime(ROOT_FREQUENCY * 0.5 * this.pitchScale, now, 0.18);
      this.drone.high.frequency.setTargetAtTime(ROOT_FREQUENCY * this.pitchScale, now, 0.18);
    }

    if (this.energy < 0.025 || this.tempoScale < 0.11) {
      this.nextNoteTime = Math.max(this.nextNoteTime, now + 0.08);
      return;
    }

    const lookAhead = now + 0.22;
    while (this.nextNoteTime < lookAhead) {
      this.scheduleStep(this.nextNoteTime);
      const beatDuration = 60 / (112 * this.tempoScale);
      this.nextNoteTime += beatDuration * 0.5;
      this.step += 1;
    }
  }

  scheduleStep(time) {
    const melodyDegree = MELODY[this.step % MELODY.length];
    const melodyNote = SCALE[melodyDegree % SCALE.length] + Math.floor(melodyDegree / SCALE.length) * 12;
    const bassNote = BASS[Math.floor(this.step / 4) % BASS.length];
    const accent = this.step % 4 === 0 ? 1 : 0.65;

    this.playTone(time, melodyNote + 12, 0.105, 0.08 * this.energy * accent, 'triangle');

    if (this.step % 4 === 0) {
      this.playTone(time, bassNote - 12, 0.32, 0.18 * this.energy, 'sawtooth');
    }

    if (this.step % 2 === 1) {
      this.playNoise(time, 0.05, 0.025 * this.energy);
    }
  }

  playTone(time, semitone, duration, level, type) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const frequency = ROOT_FREQUENCY * Math.pow(2, semitone / 12) * this.pitchScale;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(16, frequency * 0.985), time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(gain);
    gain.connect(this.filter);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.04);
  }

  playNoise(time, duration, level) {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 1800 + this.energy * 2200;
    gain.gain.setValueAtTime(Math.max(0.0001, level), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.filter);
    source.start(time);
    source.stop(time + duration);
  }
}
