class PianoPlayer {
    constructor() {
        this.audioContext = null;
        this.recording = false;
        this.recordedNotes = [];
        this.recordingStartTime = null;
        this.currentTrackId = 0;
        this.tracks = JSON.parse(localStorage.getItem('pianoTracks') || '[]');
        
        this.init();
    }

    async init() {
        // Initialize audio context on user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });

        this.setupEventListeners();
        this.renderTracks();
    }

    setupEventListeners() {
        // Mouse events for keys
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.playNote(key.dataset.note);
            });
            
            key.addEventListener('mouseup', () => {
                this.stopAllNotes();
            });
            
            key.addEventListener('mouseleave', () => {
                this.stopAllNotes();
            });
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            const keyMap = {
                'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#',
                'd': 'E', 'f': 'F', 't': 'F#', 'g': 'G',
                'y': 'G#', 'h': 'A', 'u': 'A#', 'j': 'B', 'k': 'C2'
            };
            
            const note = keyMap[e.key.toLowerCase()];
            if (note && !e.repeat) {
                e.preventDefault();
                this.playNote(note);
                
                // Visual feedback
                const key = document.querySelector(`.key[data-note="${note}"]`);
                if (key) key.classList.add('active');
            }
        });

        document.addEventListener('keyup', (e) => {
            const keyMap = {
                'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#',
                'd': 'E', 'f': 'F', 't': 'F#', 'g': 'G',
                'y': 'G#', 'h': 'A', 'u': 'A#', 'j': 'B', 'k': 'C2'
            };
            
            const note = keyMap[e.key.toLowerCase()];
            if (note) {
                const key = document.querySelector(`.key[data-note="${note}"]`);
                if (key) key.classList.remove('active');
            }
        });

        // Control buttons
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('playBtn').addEventListener('click', () => this.playLastRecording());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearRecording());
    }

    playNote(note, saveToRecording = true) {
        if (!this.audioContext) return;

        // Simple oscillator for piano sound (simplified)
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'triangle';
        oscillator.frequency.value = this.noteToFrequency(note);
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.5);

        // Visual feedback
        const key = document.querySelector(`.key[data-note="${note}"]`);
        if (key) {
            key.classList.add('active');
            setTimeout(() => key.classList.remove('active'), 200);
        }

        // Record if recording
        if (this.recording && saveToRecording) {
            const time = Date.now() - this.recordingStartTime;
            this.recordedNotes.push({ note, time, duration: 500 });
        }
    }

    stopAllNotes() {
        // In a real implementation, you'd stop all oscillators
        // For simplicity, we're using short notes
    }

    noteToFrequency(note) {
        const frequencies = {
            'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
            'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
            'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88,
            'C2': 523.25
        };
        return frequencies[note] || 440;
    }

    toggleRecording() {
        this.recording = !this.recording;
        const btn = document.getElementById('recordBtn');
        
        if (this.recording) {
            btn.style.background = '#ff4444';
            btn.textContent = '⏹️ Stop';
            this.recordedNotes = [];
            this.recordingStartTime = Date.now();
        } else {
            btn.style.background = '#ff6b6b';
            btn.textContent = '⏺️ Record';
            this.saveTrack();
        }
        
        document.getElementById('playBtn').disabled = this.recordedNotes.length === 0;
    }

    saveTrack() {
        if (this.recordedNotes.length === 0) return;

        const track = {
            id: this.currentTrackId++,
            notes: this.recordedNotes,
            date: new Date().toLocaleString(),
            duration: this.recordedNotes[this.recordedNotes.length - 1]?.time || 0
        };

        this.tracks.push(track);
        localStorage.setItem('pianoTracks', JSON.stringify(this.tracks));
        this.renderTracks();
    }

    playTrack(track) {
        this.recordedNotes = track.notes;
        this.playLastRecording();
    }

    playLastRecording() {
        if (this.recordedNotes.length === 0) return;

        this.recordedNotes.forEach(({ note, time }) => {
            setTimeout(() => {
                this.playNote(note, false);
            }, time);
        });
    }

    clearRecording() {
        this.recordedNotes = [];
        document.getElementById('playBtn').disabled = true;
    }

    deleteTrack(trackId) {
        this.tracks = this.tracks.filter(t => t.id !== trackId);
        localStorage.setItem('pianoTracks', JSON.stringify(this.tracks));
        this.renderTracks();
    }

    renderTracks() {
        const tracksDiv = document.getElementById('tracks');
        tracksDiv.innerHTML = '';

        this.tracks.slice().reverse().forEach(track => {
            const trackEl = document.createElement('div');
            trackEl.className = 'track-item';
            trackEl.innerHTML = `
                <span>🎵 ${track.date} (${(track.duration/1000).toFixed(1)}s)</span>
                <div class="track-actions">
                    <button class="track-btn play" data-id="${track.id}">▶️</button>
                    <button class="track-btn delete" data-id="${track.id}">🗑️</button>
                </div>
            `;

            trackEl.querySelector('.play').addEventListener('click', () => this.playTrack(track));
            trackEl.querySelector('.delete').addEventListener('click', () => this.deleteTrack(track.id));

            tracksDiv.appendChild(trackEl);
        });
    }
}

new PianoPlayer();