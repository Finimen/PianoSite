class PianoPlayer {
    constructor() {
        this.piano = new JJKPianoEngine({
            synthMode: true,         
            masterGain: 0.7,         
            reverbDuration: 1.25,    
            reverbDecay: 1,        
            reverbWet: 0.2,         
            chorusDepth: 0.001,      
            chorusRate: 0.25,        
            globalDetune: 2,          
            maxVoices: 32        
        });

        this.recording = false;
        this.recordedNotes = [];
        this.recordingStartTime = null;
        this.currentTrackId = 0;
        this.tracks = JSON.parse(localStorage.getItem('pianoTracks') || '[]');
        this.cloudTracks = [];
        this.token = localStorage.getItem('token');
        this.currentUser = null;
        this.activeVoices = {}; 

        this.init();
    }

    async init() {
        this.setupUI();
        this.setupEventListeners();
        this.renderTracks();
        this.updateUIForAuth();

        if (this.token) {
            await this.getCurrentUser();
        }
    }

    convertNote(oldNote) {
        const map = {
            'C': 'C4',
            'C#': 'C#4',
            'D': 'D4',
            'D#': 'D#4',
            'E': 'E4',
            'F': 'F4',
            'F#': 'F#4',
            'G': 'G4',
            'G#': 'G#4',
            'A': 'A4',
            'A#': 'A#4',
            'B': 'B4',
            'C2': 'C5'
        };
        return map[oldNote] || oldNote;
    }

    setupUI() {
        const authContainer = document.getElementById('authContainer');
        authContainer.innerHTML = `
            <button class="btn-trigger" id="showLoginBtn"><i data-feather="log-in"></i> Login</button>
            <button class="btn-trigger" id="showRegisterBtn"><i data-feather="user-plus"></i> Register</button>
        `;
        feather.replace();

        document.getElementById('closeModal').addEventListener('click', () => this.hideModal());
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showAuthTab('register');
        });
        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showAuthTab('login');
        });

        document.getElementById('showLoginBtn').addEventListener('click', () => {
            this.showAuthTab('login');
            this.showModal();
        });
        document.getElementById('showRegisterBtn').addEventListener('click', () => {
            this.showAuthTab('register');
            this.showModal();
        });

        document.getElementById('authModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('authModal')) {
                this.hideModal();
            }
        });

        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('registerBtn').addEventListener('click', () => this.register());

        const loginFields = ['loginUsername', 'loginPassword'];
        loginFields.forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.login();
            });
        });

        const registerFields = ['regUsername', 'regEmail', 'regPassword', 'regConfirmPassword'];
        registerFields.forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.register();
            });
        });

        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    }

    showModal() {
        document.getElementById('authModal').style.display = 'flex';
    }

    hideModal() {
        document.getElementById('authModal').style.display = 'none';
    }

    showAuthTab(tab) {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const modalTitle = document.getElementById('modalTitle');

        if (tab === 'login') {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            modalTitle.textContent = 'Login';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            modalTitle.textContent = 'Awaken';
        }
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
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        if (!username || !email || !password || !confirmPassword) {
            this.showMessage('register', 'All fields are required.', false);
            return;
        }
        if (password !== confirmPassword) {
            this.showMessage('register', 'Passwords do not match.', false);
            return;
        }
        if (password.length < 8) {
            this.showMessage('register', 'Password must be at least 8 characters.', false);
            return;
        }

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: username, email, password })
            });
            const data = await response.json();

            if (response.ok) {
                this.showMessage('register', 'Registration successful! Please login.', true);
                document.getElementById('regUsername').value = '';
                document.getElementById('regEmail').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regConfirmPassword').value = '';
                setTimeout(() => this.showAuthTab('login'), 1000);
            } else {
                this.showMessage('register', data.detail || 'Registration failed.', false);
            }
        } catch (error) {
            this.showMessage('register', 'Network error. Please try again.', false);
            console.error(error);
        }
    }

    async login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            this.showMessage('login', 'All fields are required.', false);
            return;
        }

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: username, password })
            });
            const data = await response.json();

            if (response.ok) {
                this.token = data.access_token;
                localStorage.setItem('token', this.token);
                this.showMessage('login', 'Login successful!', true);
                document.getElementById('loginUsername').value = '';
                document.getElementById('loginPassword').value = '';
                await this.getCurrentUser();
                this.hideModal();
                this.updateUIForAuth();
            } else {
                this.showMessage('login', data.detail || 'Login failed.', false);
            }
        } catch (error) {
            this.showMessage('login', 'Network error. Please try again.', false);
            console.error(error);
        }
    }

    async getCurrentUser() {
        if (!this.token) return;
        try {
            const response = await fetch('/auth/me', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this.currentUser = await response.json();
                document.getElementById('welcomeUser').textContent = this.currentUser.name;
                const avatarImg = document.querySelector('.user-avatar img');
                avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.name)}&background=8a2be2&color=fff&size=32`;
                this.updateUIForAuth();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error(error);
        }
    }

    updateUIForAuth() {
        const authContainer = document.getElementById('authContainer');
        const userProfile = document.getElementById('userProfile');
        if (this.currentUser) {
            authContainer.classList.add('hidden');
            userProfile.style.display = 'flex';
            document.getElementById('saveTrackBtn').disabled = false;
        } else {
            authContainer.classList.remove('hidden');
            userProfile.style.display = 'none';
            document.getElementById('saveTrackBtn').disabled = true;
        }
    }

    logout() {
        if (this.token) {
            fetch('/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            }).catch(() => {});
        }
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('token');
        this.updateUIForAuth();
        this.piano.allNotesOff();
        this.activeVoices = {};
    }

    setupEventListeners() {
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.playNote(key.dataset.note);
            });
            key.addEventListener('mouseup', () => this.stopNote(key.dataset.note));
            key.addEventListener('mouseleave', () => this.stopNote(key.dataset.note));
        });

        document.addEventListener('keydown', (e) => {
            const activeEl = document.activeElement;
            if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable) return;

            const keyMap = {
                'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#',
                'd': 'E', 'f': 'F', 't': 'F#', 'g': 'G',
                'y': 'G#', 'h': 'A', 'u': 'A#', 'j': 'B', 'k': 'C2'
            };
            const note = keyMap[e.key.toLowerCase()];
            if (note && !e.repeat) {
                e.preventDefault();
                this.playNote(note);
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
                this.stopNote(note);
                const key = document.querySelector(`.key[data-note="${note}"]`);
                if (key) key.classList.remove('active');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                console.log('⚡ DOMAIN EXPANSION ⚡');
                
                if (!this.piano._ready) {
                    this.piano.initOnUserGesture().then(() => {
                        this.piano.playDomainExpansion();
                    });
                } else {
                    this.piano.playDomainExpansion();
                }
                return;
            }

            if (e.ctrlKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                console.log('🎵 Playing Hollow Purple Demo...');
                
                if (!this.piano._ready) {
                    this.piano.initOnUserGesture().then(() => {
                        this.piano.playHollowPurpleDemo();
                    });
                } else {
                    this.piano.playHollowPurpleDemo();
                }
            }
        });

        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('playBtn').addEventListener('click', () => this.playLastRecording());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearRecording());
        document.getElementById('saveTrackBtn').addEventListener('click', () => this.saveToCloud());
    }

    createCursedParticle(x, y) {
        const particle = document.createElement('div');
        particle.className = 'cursed-particle';
        particle.style.left = (x - 15) + 'px';
        particle.style.top = (y - 15) + 'px';
        particle.style.width = (20 + Math.random() * 20) + 'px';
        particle.style.height = (20 + Math.random() * 20) + 'px';
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 800);
    }

    async playNote(note, saveToRecording = true) {

        console.log('playNote called with:', note);
        const jjkNote = this.convertNote(note);

        if (!this.piano._ready) {
            try {
                await this.piano.initOnUserGesture();
            } catch (e) {
                console.error('Не удалось инициализировать аудио', e);
                return;
            }
        }

        const key = document.querySelector(`.key[data-note="${note}"]`);
        if (key) {
            const rect = key.getBoundingClientRect();
            const centerX = rect.left + rect.width/2;
            const centerY = rect.top + rect.height/2;
            
            for (let i = 0; i < 6; i++) {
                setTimeout(() => {
                    this.createCursedParticle(centerX + (Math.random()-0.5)*50, centerY + (Math.random()-0.5)*30);
                }, i * 60);
            }
            
            key.classList.add('active');
        }

        const voice = this.piano.play(jjkNote, 0.9, 5); 
        this.activeVoices[note] = voice;

        if (this.recording && saveToRecording) {
            const time = Date.now() - this.recordingStartTime;
            this.recordedNotes.push({ note, time, duration: 1000 }); 
        }
    }

    stopNote(note) {
        if (this.activeVoices[note]) {
            this.activeVoices[note].forceStop();
            delete this.activeVoices[note];
        }
        const key = document.querySelector(`.key[data-note="${note}"]`);
        if (key) key.classList.remove('active');
    }

    stopAllNotes() {
        for (let note in this.activeVoices) {
            this.stopNote(note);
        }
    }

    toggleRecording() {
        this.recording = !this.recording;
        const btn = document.getElementById('recordBtn');
        if (this.recording) {
            btn.innerHTML = '<i data-feather="stop-circle"></i> Stop';
            this.recordedNotes = [];
            this.recordingStartTime = Date.now();
        } else {
            btn.innerHTML = '<i data-feather="circle"></i> Record';
            this.saveTrack();
        }
        feather.replace();
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
                const jjkNote = this.convertNote(note);
                this.piano.play(jjkNote, 0.9, 1.0);
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
        const container = document.getElementById('tracks');
        container.innerHTML = '';

        if (this.tracks.length === 0) {
            container.innerHTML = '<div class="empty-state">No cursed techniques yet. Record one.</div>';
            return;
        }

        this.tracks.slice().reverse().forEach(track => {
            const div = document.createElement('div');
            div.className = 'track-item';
            div.innerHTML = `
                <div class="track-info">
                    <span class="track-date">${track.date}</span>
                    <span class="track-duration">${(track.duration/1000).toFixed(1)}s</span>
                </div>
                <div class="track-actions">
                    <button class="track-btn play" data-id="${track.id}" title="Play"><i data-feather="play"></i></button>
                    <button class="track-btn delete" data-id="${track.id}" title="Delete"><i data-feather="trash-2"></i></button>
                </div>
            `;
            container.appendChild(div);
            div.querySelector('.play').addEventListener('click', () => this.playTrack(track));
            div.querySelector('.delete').addEventListener('click', () => this.deleteTrack(track.id));
        });

        feather.replace();
        document.getElementById('cloudTracksCount').textContent = this.tracks.length;
    }

    async saveToCloud() {
        if (!this.token) {
            this.showAuthTab('login');
            this.showModal();
            return;
        }
        if (this.recordedNotes.length === 0) return;

        try {
            const response = await fetch('/tracks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    name: `Track ${new Date().toLocaleString()}`,
                    notes: this.recordedNotes
                })
            });
            if (response.ok) {
                this.showMessage('login', 'Saved to domain!', true);
                await this.loadCloudTracks();
            }
        } catch (error) {
            console.error(error);
        }
    }

    async loadCloudTracks() {
        if (!this.token) return;
        try {
            const response = await fetch('/tracks', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this.cloudTracks = await response.json();
            }
        } catch (error) {
            console.error(error);
        }
    }
}

new PianoPlayer();

document.addEventListener('mousemove', (e) => {
    console.log('Key pressed:', e.key)
    const pianoContainer = document.querySelector('.piano-container');
    if (pianoContainer) {
        const rect = pianoContainer.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        pianoContainer.style.setProperty('--mouse-x', x + '%');
        pianoContainer.style.setProperty('--mouse-y', y + '%');
    }
});