class PianoPlayer {
    constructor() {
        this.audioContext = null;
        this.recording = false;
        this.recordedNotes = [];
        this.recordingStartTime = null;
        this.currentTrackId = 0;
        this.tracks = JSON.parse(localStorage.getItem('pianoTracks') || '[]');
        this.cloudTracks = [];
        this.token = localStorage.getItem('token');
        this.currentUser = null;
        
        this.init();
    }

    async init() {
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });

        this.setupEventListeners();
        this.renderTracks();
        this.setupAuth();
        
        if (this.token) {
            await this.getCurrentUser();
        }
    }

    setupAuth() {
        // Tab switching
        document.getElementById('loginTab').addEventListener('click', () => this.showAuthTab('login'));
        document.getElementById('registerTab').addEventListener('click', () => this.showAuthTab('register'));
        
        // Form submissions
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('registerBtn').addEventListener('click', () => this.register());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Enter key presses
        document.getElementById('loginUsername').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        document.getElementById('regUsername').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
        document.getElementById('regEmail').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
        document.getElementById('regPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
        document.getElementById('regConfirmPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
    }

    showAuthTab(tab) {
        document.getElementById('loginTab').classList.toggle('active', tab === 'login');
        document.getElementById('registerTab').classList.toggle('active', tab === 'register');
        document.getElementById('loginForm').classList.toggle('active', tab === 'login');
        document.getElementById('registerForm').classList.toggle('active', tab === 'register');
    }

    showMessage(form, message, isSuccess) {
        const msgEl = document.getElementById(form === 'login' ? 'loginMessage' : 'registerMessage');
        msgEl.textContent = message;
        msgEl.className = 'auth-message ' + (isSuccess ? 'success' : 'error');
        
        if (isSuccess) {
            setTimeout(() => {
                msgEl.textContent = '';
                msgEl.className = 'auth-message';
            }, 3000);
        }
    }

    async register() {
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        
        // Validation
        if (!username || !email || !password || !confirmPassword) {
            this.showMessage('register', 'Please fill all fields', false);
            return;
        }
        
        if (password !== confirmPassword) {
            this.showMessage('register', 'Passwords do not match', false);
            return;
        }
        
        if (password.length < 8) {
            this.showMessage('register', 'Password must be at least 8 characters', false);
            return;
        }
        
        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: username,
                    email: email,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showMessage('register', 'Registration successful! Please login.', true);
                document.getElementById('regUsername').value = '';
                document.getElementById('regEmail').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regConfirmPassword').value = '';
                
                // Switch to login tab after 1 second
                setTimeout(() => this.showAuthTab('login'), 1000);
            } else {
                this.showMessage('register', data.detail || 'Registration failed', false);
            }
        } catch (error) {
            this.showMessage('register', 'Network error. Please try again.', false);
            console.error('Registration error:', error);
        }
    }

    async login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            this.showMessage('login', 'Please fill all fields', false);
            return;
        }
        
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: username,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store token
                this.token = data.access_token;
                localStorage.setItem('token', this.token);
                
                this.showMessage('login', 'Login successful!', true);
                document.getElementById('loginUsername').value = '';
                document.getElementById('loginPassword').value = '';
                
                // Get user info
                await this.getCurrentUser();
                
                // Show user info
                this.showUserInfo();
            } else {
                this.showMessage('login', data.detail || 'Login failed', false);
            }
        } catch (error) {
            this.showMessage('login', 'Network error. Please try again.', false);
            console.error('Login error:', error);
        }
    }

    async getCurrentUser() {
        if (!this.token) return;
        
        try {
            const response = await fetch('/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                document.getElementById('welcomeUser').textContent = `Welcome, ${this.currentUser.name}!`;
                this.showUserInfo();
            } else {
                // Token expired or invalid
                this.logout();
            }
        } catch (error) {
            console.error('Get user error:', error);
        }
    }

    showUserInfo() {
        document.querySelector('.auth-tabs').style.display = 'none';
        document.getElementById('loginForm').classList.remove('active');
        document.getElementById('registerForm').classList.remove('active');
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('saveTrackBtn').disabled = false;
    }

    async logout() {
        try {
            if (this.token) {
                await fetch('/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear token regardless
            this.token = null;
            this.currentUser = null;
            localStorage.removeItem('token');
            
            // Show auth forms
            document.querySelector('.auth-tabs').style.display = 'flex';
            document.getElementById('userInfo').style.display = 'none';
            document.getElementById('loginForm').classList.add('active');
            document.getElementById('registerForm').classList.remove('active');
            document.getElementById('saveTrackBtn').disabled = true;
            
            this.showAuthTab('login');
        }
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

        document.addEventListener('keydown', (e) => {
            // Check if the active element is an input field
            const activeElement = document.activeElement;
            const isInputField = activeElement.tagName === 'INPUT' || 
                                activeElement.tagName === 'TEXTAREA' || 
                                activeElement.isContentEditable;
            
            // Don't trigger piano if user is typing in an input field
            if (isInputField) {
                return;
            }
            
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
            // Check if the active element is an input field
            const activeElement = document.activeElement;
            const isInputField = activeElement.tagName === 'INPUT' || 
                                activeElement.tagName === 'TEXTAREA' || 
                                activeElement.isContentEditable;
            
            // Don't trigger piano if user is typing in an input field
            if (isInputField) {
                return;
            }
            
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