class JJKPianoEngine {
    constructor(opts = {}) {
        this.audioContext = null;
        this.voices = new Set();
        this.maxVoices = opts.maxVoices || 48;

        this.reverbDuration = opts.reverbDuration || 4.5;
        this.reverbDecay = opts.reverbDecay || 2.6;
        this.reverbWet = typeof opts.reverbWet === 'number' ? opts.reverbWet : 0.7;

        this.masterGainVal = typeof opts.masterGain === 'number' ? opts.masterGain : 0.85;

        this.sustain = false;
        this.globalDetune = opts.globalDetune || 0;

        this.synthMode = !!opts.synthMode;
        this.chorusDepth = typeof opts.chorusDepth === 'number' ? opts.chorusDepth : 0.0045;
        this.chorusRate = typeof opts.chorusRate === 'number' ? opts.chorusRate : 0.22;

        this._ready = false;
        this._impulse = null;
    }

    initOnUserGesture() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.init();
    }

    async init() {
        if (!this.audioContext) this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (this._ready) return;

        this.master = this.audioContext.createGain();
        this.master.gain.value = this.masterGainVal;

        this.hp = this.audioContext.createBiquadFilter();
        this.hp.type = 'highpass';
        this.hp.frequency.value = 50;

        this.reverb = this.audioContext.createConvolver();
        this.reverbGain = this.audioContext.createGain();
        this.reverbGain.gain.value = this.reverbWet;

        this.preDelay = this.audioContext.createDelay(0.12);
        this.preDelay.delayTime.value = 0.035;

        this.stereoDelayL = this.audioContext.createDelay(0.05);
        this.stereoDelayR = this.audioContext.createDelay(0.05);
        this.stereoDelayL.delayTime.value = 0.0;
        this.stereoDelayR.delayTime.value = 0.01;

        // CHORUS
        this.chorusDelay = this.audioContext.createDelay(0.05);
        this.chorusDelay.delayTime.value = this.chorusDepth;

        this.chorusGain = this.audioContext.createGain();
        this.chorusGain.gain.value = 0.6;

        this.chorusLFO = this.audioContext.createOscillator();
        this.chorusLFOGain = this.audioContext.createGain();
        this.chorusLFOGain.gain.value = this.chorusDepth;

        this.chorusLFO.frequency.value = this.chorusRate;
        this.chorusLFO.connect(this.chorusLFOGain);
        this.chorusLFOGain.connect(this.chorusDelay.delayTime);
        this.chorusLFO.start();

        this.reverb.connect(this.reverbGain);
        this.reverbGain.connect(this.master);

        this.preDelay.connect(this.reverb);

        this.master.connect(this.hp);
        this.hp.connect(this.audioContext.destination);

        this.chorusDelay.connect(this.chorusGain);
        this.chorusGain.connect(this.master);
        this.chorusGain.connect(this.preDelay);

        this._impulse = this._createImpulse(this.reverbDuration, this.reverbDecay);
        this.reverb.buffer = this._impulse;

        this._ready = true;
    }

    noteToFrequency(note) {
        const match = String(note).match(/^([A-G])(#|b)?(\d?)$/i);
        if (!match) {
            const map = { 'C':261.63,'C#':277.18,'D':293.66,'D#':311.13,'E':329.63,'F':349.23,'F#':369.99,'G':392.00,'G#':415.30,'A':440.00,'A#':466.16,'B':493.88 };
            return map[note] || 440;
        }

        const letter = match[1].toUpperCase();
        const accidental = match[2] || '';
        let octave = match[3] ? parseInt(match[3]) : 4;

        const semitoneFromC0 = {
            'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,
            'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,
            'A':9,'A#':10,'Bb':10,'B':11
        }[letter + accidental] ?? 9;

        const midi = (octave + 1) * 12 + semitoneFromC0;
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    _createImpulse(seconds = 4.5, decay = 2.4) {
        const rate = this.audioContext.sampleRate;
        const length = Math.floor(rate * seconds);
        const impulse = this.audioContext.createBuffer(2, length, rate);

        for (let ch = 0; ch < 2; ch++) {
            const channel = impulse.getChannelData(ch);

            for (let i = 0; i < length; i++) {
                const t = i / length;

                const rand = (Math.random() * 2 - 1) * (1 - t) * Math.pow(1 - t, decay);
                const early = (i < rate * 0.02) ? (Math.random() * 2 - 1) * 0.7 : 0;

                const stereoOffset = (ch === 0)
                    ? Math.cos(t * Math.PI * 0.5)
                    : Math.sin(t * Math.PI * 0.5);

                channel[i] = rand * 0.9 + early * 0.6 + 0.02 * stereoOffset;
            }
        }

        return impulse;
    }

    play(note, velocity = 0.9, duration = 0.5) {
        if (!this._ready) {
            this.init();
            if (this.audioContext.state === 'suspended') {
                try { this.audioContext.resume(); } catch (e) {}
            }
        }

        const now = this.audioContext.currentTime;

        const freq = this.noteToFrequency(note) * Math.pow(2, this.globalDetune / 1200);

        const voice = { nodes: [], stopped: false };
        this.voices.add(voice);

        if (this.voices.size > this.maxVoices) {
            const it = this.voices.values();
            const oldest = it.next().value;
            if (oldest) this._forceStopVoice(oldest);
        }

        const bodyOsc = this.audioContext.createOscillator();
        bodyOsc.type = this.synthMode ? 'sawtooth' : 'triangle';
        bodyOsc.frequency.value = freq;

        const bodyGain = this.audioContext.createGain();

        const bodyAttack = 0.01;
        const bodyDecay = Math.max(0.07, duration * 0.25);
        const bodySustain = 0.18 * velocity;

        bodyGain.gain.setValueAtTime(0.0001, now);
        bodyGain.gain.linearRampToValueAtTime(velocity, now + bodyAttack);
        bodyGain.gain.linearRampToValueAtTime(bodySustain, now + bodyAttack + bodyDecay);

        const bodyFilter = this.audioContext.createBiquadFilter();
        bodyFilter.type = 'lowpass';
        bodyFilter.frequency.value = this.synthMode ? 2200 : 3200;
        bodyFilter.Q.value = 0.9;

        // PAD LAYER (synthMode)
        let padNodes = [];

        if (this.synthMode) {
            const detune = 7;

            for (let i = 0; i < 2; i++) {
                const osc = this.audioContext.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = freq * (i === 0 ? 1 : 2);
                osc.detune.value = i === 0 ? -detune : detune;

                const g = this.audioContext.createGain();
                g.gain.value = 0.18 * velocity;

                const f = this.audioContext.createBiquadFilter();
                f.type = 'lowpass';
                f.frequency.value = 2000;

                osc.connect(f);
                f.connect(g);

                padNodes.push({ osc, g, f });

                osc.start(now);
            }
        }

        const bellOsc = this.audioContext.createOscillator();
        bellOsc.type = 'sine';
        bellOsc.frequency.value = freq * 2.005;

        const mod = this.audioContext.createOscillator();
        mod.type = 'sine';
        mod.frequency.value = 6 + (Math.random() * 4 - 2);

        const modGain = this.audioContext.createGain();
        modGain.gain.value = 0.9 * velocity;

        const bellGain = this.audioContext.createGain();
        bellGain.gain.setValueAtTime(0.0001, now);
        bellGain.gain.linearRampToValueAtTime(0.65 * velocity, now + 0.005);
        bellGain.gain.linearRampToValueAtTime(0.0001, now + Math.min(0.45, duration * 0.9));

        const panner = this.audioContext.createStereoPanner();
        panner.pan.value = (Math.random() * 0.3) - 0.15;

        const dryGain = this.audioContext.createGain();
        const wetSend = this.audioContext.createGain();

        dryGain.gain.value = 0.7;
        wetSend.gain.value = 0.5;

        bodyOsc.connect(bodyFilter);
        bodyFilter.connect(bodyGain);

        bodyGain.connect(dryGain);
        bodyGain.connect(wetSend);

        mod.connect(modGain);
        modGain.connect(bellOsc.frequency);

        bellOsc.connect(bellGain);
        bellGain.connect(dryGain);
        bellGain.connect(wetSend);

        padNodes.forEach(p => {
            p.g.connect(dryGain);
            p.g.connect(wetSend);
        });

        dryGain.connect(panner);
        wetSend.connect(this.preDelay);

        panner.connect(this.stereoDelayL);
        panner.connect(this.stereoDelayR);

        this.stereoDelayL.connect(this.chorusDelay);
        this.stereoDelayR.connect(this.chorusDelay);

        panner.connect(this.master);

        bodyOsc.start(now);
        bellOsc.start(now);
        mod.start(now);

        voice.nodes.push(
            bodyOsc, bodyGain, bodyFilter,
            bellOsc, bellGain, mod, modGain,
            dryGain, wetSend, panner
        );

        padNodes.forEach(p => voice.nodes.push(p.osc, p.g, p.f));

        const release = () => {
            if (voice.stopped) return;
            voice.stopped = true;

            const rNow = this.audioContext.currentTime;

            bodyGain.gain.cancelScheduledValues(rNow);
            bodyGain.gain.setValueAtTime(bodyGain.gain.value, rNow);
            bodyGain.gain.linearRampToValueAtTime(0.0001, rNow + 0.3);

            bellGain.gain.cancelScheduledValues(rNow);
            bellGain.gain.setValueAtTime(bellGain.gain.value, rNow);
            bellGain.gain.linearRampToValueAtTime(0.0001, rNow + 0.6);

            const stopAt = rNow + 1.0;

            try { bodyOsc.stop(stopAt); } catch (e) {}
            try { bellOsc.stop(stopAt); } catch (e) {}
            try { mod.stop(stopAt); } catch (e) {}

            padNodes.forEach(p => {
                try { p.osc.stop(stopAt); } catch (e) {}
            });

            setTimeout(() => this._cleanupVoice(voice), (stopAt - rNow) * 1000 + 50);
        };

        if (this.sustain) {
            voice.releaseWhenSustainOff = () => release();
        } else {
            setTimeout(release, Math.max(20, duration * 1000));
        }

        voice.forceStop = () => {
            if (voice.stopped) return;
            voice.stopped = true;

            const rNow = this.audioContext.currentTime;

            try {
                bodyGain.gain.cancelScheduledValues(rNow);
                bodyGain.gain.linearRampToValueAtTime(0.0001, rNow + 0.05);
            } catch (e) {}

            try {
                bellGain.gain.cancelScheduledValues(rNow);
                bellGain.gain.linearRampToValueAtTime(0.0001, rNow + 0.05);
            } catch (e) {}

            const stopAt = rNow + 0.08;

            try { bodyOsc.stop(stopAt); } catch (e) {}
            try { bellOsc.stop(stopAt); } catch (e) {}
            try { mod.stop(stopAt); } catch (e) {}

            padNodes.forEach(p => {
                try { p.osc.stop(stopAt); } catch (e) {}
            });

            setTimeout(() => this._cleanupVoice(voice), (stopAt - rNow) * 1000 + 50);
        };

        return voice;
    }

    _cleanupVoice(voice) {
        try {
            (voice.nodes || []).forEach(node => {
                try { node.disconnect && node.disconnect(); } catch (e) {}
            });
        } catch (e) {}

        this.voices.delete(voice);
    }

    _forceStopVoice(voice) {
        try {
            if (voice && typeof voice.forceStop === 'function') voice.forceStop();
            else this._cleanupVoice(voice);
        } catch (e) {
            this._cleanupVoice(voice);
        }
    }

    playChord(notes = [], velocity = 0.9, duration = 0.6) {
        notes.forEach(n => this.play(n, velocity, duration));
    }

    playArp(notes = [], velocity = 0.85, noteDur = 0.25, spacing = 0.08) {
        notes.forEach((n, i) => {
            setTimeout(() => this.play(n, velocity, noteDur), i * spacing * 1000);
        });
    }

    playSequence(sequence = []) {
        let t = 0;

        sequence.forEach(item => {
            const delay = typeof item.delay === 'number' ? item.delay : 0;
            t += delay;

            setTimeout(() => {
                this.play(
                    item.note,
                    typeof item.vel === 'number' ? item.vel : 0.9,
                    typeof item.dur === 'number' ? item.dur : 0.5
                );
            }, t * 1000);

            t += typeof item.dur === 'number' ? item.dur : 0.5;
        });
    }

    setSustain(on) {
        this.sustain = !!on;

        if (!this.sustain) {
            for (const v of Array.from(this.voices)) {
                if (v && typeof v.releaseWhenSustainOff === 'function') {
                    try { v.releaseWhenSustainOff(); } catch (e) {}
                    delete v.releaseWhenSustainOff;
                }
            }
        }
    }

    allNotesOff() {
        for (const v of Array.from(this.voices)) {
            this._forceStopVoice(v);
        }
    }

    async resume() {
        if (!this.audioContext) this.init();

        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    playHollowPurpleDemo() {
        const seq = [
            { note: "A3", dur: 0.7, vel: 0.9 },
            { note: "E4", dur: 0.7, vel: 0.85, delay: 0.05 },
            { note: "A4", dur: 1.0, vel: 0.9, delay: 0.05 },

            { note: "G3", dur: 0.6, vel: 0.85, delay: 0.4 },
            { note: "D4", dur: 0.6, vel: 0.8, delay: 0.05 },
            { note: "G4", dur: 0.9, vel: 0.85, delay: 0.05 },

            { note: "F3", dur: 0.7, vel: 0.85, delay: 0.4 },
            { note: "C4", dur: 0.7, vel: 0.8, delay: 0.05 },
            { note: "F4", dur: 1.0, vel: 0.9, delay: 0.05 },

            // rising tension
            { note: "G3", dur: 0.35, vel: 0.8, delay: 0.5 },
            { note: "A3", dur: 0.35, vel: 0.82 },
            { note: "C4", dur: 0.35, vel: 0.85 },
            { note: "E4", dur: 0.45, vel: 0.9 },

            // hollow purple impact chord
            { note: "A3", dur: 1.8, vel: 1.0, delay: 0.25 },
            { note: "E4", dur: 1.8, vel: 1.0 },
            { note: "A4", dur: 2.0, vel: 1.0 },
            { note: "C5", dur: 2.0, vel: 0.95 }
        ];

        this.playSequence(seq);

        // subtle arp layer for atmosphere
        setTimeout(() => {
            this.playArp(["A4", "C5", "E5", "A5"], 0.7, 0.22, 0.07);
        }, 2200);
    }

    playDomainExpansion() {
        console.log('⚡ DOMAIN EXPANSION: FEMTO ⚡');
        
        // Вступление - мрачное и тяжелое
        const intro = [
            { note: "F2", dur: 1.2, vel: 0.9 },
            { note: "Ab2", dur: 1.2, vel: 0.85, delay: 0.1 },
            { note: "C3", dur: 1.5, vel: 0.9, delay: 0.1 },
            
            { note: "F2", dur: 1.0, vel: 0.85, delay: 0.3 },
            { note: "Ab2", dur: 1.0, vel: 0.8, delay: 0.1 },
            { note: "C3", dur: 1.3, vel: 0.85, delay: 0.1 },
            
            { note: "Gb2", dur: 1.2, vel: 0.9, delay: 0.4 },
            { note: "A2", dur: 1.2, vel: 0.85, delay: 0.1 },
            { note: "Db3", dur: 1.5, vel: 0.9, delay: 0.1 }
        ];
        
        // Основная тема - мощные аккорды
        const mainTheme = [
            // Фраза 1
            { note: "F3", dur: 0.8, vel: 0.95, delay: 0.5 },
            { note: "C4", dur: 0.8, vel: 0.9 },
            { note: "F4", dur: 1.2, vel: 1.0 },
            
            { note: "Eb3", dur: 0.7, vel: 0.9, delay: 0.3 },
            { note: "Bb3", dur: 0.7, vel: 0.85 },
            { note: "Eb4", dur: 1.0, vel: 0.95 },
            
            { note: "Db3", dur: 0.7, vel: 0.9, delay: 0.3 },
            { note: "Ab3", dur: 0.7, vel: 0.85 },
            { note: "Db4", dur: 1.0, vel: 0.95 },
            
            // Фраза 2 (повышение)
            { note: "G3", dur: 0.8, vel: 0.95, delay: 0.4 },
            { note: "D4", dur: 0.8, vel: 0.9 },
            { note: "G4", dur: 1.2, vel: 1.0 },
            
            { note: "F3", dur: 0.7, vel: 0.9, delay: 0.3 },
            { note: "C4", dur: 0.7, vel: 0.85 },
            { note: "F4", dur: 1.0, vel: 0.95 },
            
            { note: "Eb3", dur: 0.7, vel: 0.9, delay: 0.3 },
            { note: "Bb3", dur: 0.7, vel: 0.85 },
            { note: "Eb4", dur: 1.0, vel: 0.95 }
        ];
        
        // Кульминация - "Domain Expansion"
        const climax = [
            // Мощный подъем
            { note: "C3", dur: 0.5, vel: 0.9, delay: 0.6 },
            { note: "Eb3", dur: 0.5, vel: 0.9 },
            { note: "G3", dur: 0.5, vel: 0.9 },
            { note: "C4", dur: 0.8, vel: 1.0 },
            
            { note: "C#3", dur: 0.5, vel: 0.9, delay: 0.3 },
            { note: "F3", dur: 0.5, vel: 0.9 },
            { note: "G#3", dur: 0.5, vel: 0.9 },
            { note: "C#4", dur: 0.8, vel: 1.0 },
            
            // Финальный аккорд (Domain Expansion тема)
            { note: "F2", dur: 3.5, vel: 1.0, delay: 0.5 },
            { note: "Ab2", dur: 3.5, vel: 0.95 },
            { note: "C3", dur: 3.5, vel: 1.0 },
            { note: "F3", dur: 3.5, vel: 0.9 },
            { note: "Ab3", dur: 3.5, vel: 0.9 },
            { note: "C4", dur: 4.0, vel: 1.0 },
            { note: "F4", dur: 4.0, vel: 0.95 }
        ];
        
        // Запускаем все части
        this.playSequence(intro);
        
        setTimeout(() => {
            this.playSequence(mainTheme);
        }, 4500); // После вступления
        
        setTimeout(() => {
            this.playSequence(climax);
        }, 9500); // После основной темы
        
        // Добавляем атмосферные арпеджио поверх
        setTimeout(() => {
            this.playArp(["F4", "Ab4", "C5", "F5"], 0.6, 0.2, 0.06);
        }, 2000);
        
        setTimeout(() => {
            this.playArp(["C4", "Eb4", "G4", "C5"], 0.65, 0.18, 0.05);
        }, 6000);
        
        setTimeout(() => {
            // Финальный арпеджио с усилением
            this.playArp(["F4", "C5", "F5", "Ab5", "C6"], 0.7, 0.15, 0.04);
        }, 11000);
        
        // Добавляем басовый дрон
        setTimeout(() => {
            this.play("F2", 0.8, 8.0);
        }, 500);
    }
}
