class OCRCameraManager {
    constructor() {
        this.videoElement = document.getElementById('videoElement');
        this.canvasElement = document.getElementById('canvasElement');
        this.captureBtn = document.getElementById('captureBtn');
        this.retakeBtn = document.getElementById('retakeBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.processCapturedBtn = document.getElementById('processBtn');
        this.useAsIsBtn = document.getElementById('useAsIsBtn');
        this.cameraPreview = document.getElementById('previewSection');
        this.imagePreviewCanvas = document.getElementById('imagePreview');
        this.flashToggle = document.getElementById('flashToggle');
        this.uploadFromGallery = document.getElementById('uploadFromGallery');
        this.backCameraBtn = document.getElementById('backCameraBtn');
        this.frontCameraBtn = document.getElementById('frontCameraBtn');
        this.cameraSection = document.getElementById('cameraSection');

        this.stream = null;
        this.capturedImage = null;
        this.currentCamera = 'environment';
        this.isFlashOn = false;
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupModeToggle();
    }

    setupEventListeners() {
        const toggleBtns = document.querySelectorAll('.camera-option-btn');
        toggleBtns.forEach(btn => {
            if (btn.dataset.mode) {
                btn.addEventListener('click', (e) => this.switchMode(e.target.dataset.mode));
            }
        });

        this.captureBtn.addEventListener('click', () => this.capturePhoto());
        this.retakeBtn.addEventListener('click', () => this.retakePhoto());
        this.cancelBtn.addEventListener('click', () => this.cancelCapture());
        this.processCapturedBtn.addEventListener('click', () => this.processCapturedImage());
        this.useAsIsBtn.addEventListener('click', () => this.useAsIs());

        this.backCameraBtn.addEventListener('click', () => this.switchCamera('environment'));
        this.frontCameraBtn.addEventListener('click', () => this.switchCamera('user'));

        this.flashToggle.addEventListener('click', () => this.toggleFlash());

        this.uploadFromGallery.addEventListener('click', () => this.uploadFromGalleryHandler());

        window.addEventListener('beforeunload', () => {
            this.cleanupCamera();
        });
    }

    setupModeToggle() {
        this.switchMode('camera');
    }

    async switchMode(mode) {
        document.querySelectorAll('.camera-option-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'upload') {
            this.cameraSection.classList.add('hidden');
            this.cameraPreview.classList.add('hidden');
            this.cleanupCamera();
        } else if (mode === 'camera') {
            this.cameraSection.classList.remove('hidden');
            this.cameraPreview.classList.add('hidden');
            await this.initCamera();
        }
    }

    async initCamera() {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            let constraints;

            if (this.isMobile) {
                constraints = {
                    video: {
                        facingMode: this.currentCamera,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };
            } else {
                constraints = {
                    video: {
                        facingMode: this.currentCamera,
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };
            }

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;

            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
            };

        } catch (error) {
            console.error('Camera error:', error);
            this.showCameraError(error);
        }
    }

    showCameraError(error) {
        let errorMessage = 'Camera access error';

        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera found on this device';
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'Camera access was denied. Please allow camera access in your browser settings.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'Camera is already in use by another application';
        }

        this.cameraSection.innerHTML = `
            <div class="no-camera">
                <h3>Camera Not Available</h3>
                <p>${errorMessage}</p>
                <button class="camera-btn camera-btn-primary" onclick="location.reload()">
                    Try Again
                </button>
            </div>
        `;
    }

    capturePhoto() {
        if (!this.stream) return;

        const context = this.canvasElement.getContext('2d');
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;

        this.canvasElement.width = videoWidth;
        this.canvasElement.height = videoHeight;

        context.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight);

        this.capturedImage = this.canvasElement.toDataURL('image/jpeg', 0.9);
        this.imagePreviewCanvas.src = this.capturedImage;
        this.cameraPreview.style.display = 'block';

        this.captureBtn.style.display = 'none';
        this.retakeBtn.style.display = 'flex';

        this.cleanupCamera();
    }

    retakePhoto() {
        this.cameraPreview.style.display = 'none';
        this.captureBtn.style.display = 'flex';
        this.retakeBtn.style.display = 'none';

        this.capturedImage = null;
        this.initCamera();
    }

    cancelCapture() {
        this.cleanupCamera();
        this.switchMode('upload');
    }

    async processCapturedImage() {
        if (!this.capturedImage) return;

        localStorage.setItem('cameraCapture', this.capturedImage);
        window.location.href = 'ocr.html';
    }

    useAsIs() {
        localStorage.setItem('cameraCapture', this.capturedImage);
        window.location.href = 'ocr.html';
    }

    async switchCamera(cameraType) {
        if (this.currentCamera === cameraType) return;

        this.currentCamera = cameraType;

        this.backCameraBtn.classList.toggle('active', cameraType === 'environment');
        this.frontCameraBtn.classList.toggle('active', cameraType === 'user');

        this.cleanupCamera();
        await this.initCamera();
    }

    toggleFlash() {
        this.isFlashOn = !this.isFlashOn;
        this.flashToggle.textContent = this.isFlashOn ? '💡' : '⚡';

        if (this.stream) {
            const track = this.stream.getVideoTracks()[0];
            if (track && track.getCapabilities && track.getCapabilities().torch) {
                track.applyConstraints({
                    advanced: [{ torch: this.isFlashOn }]
                }).catch(error => {
                    console.log('Flash not supported:', error);
                });
            }
        }
    }

    uploadFromGalleryHandler() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 10 * 1024 * 1024) {
                    alert('File size too large. Maximum size is 10MB.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    this.capturedImage = event.target.result;
                    this.imagePreviewCanvas.src = this.capturedImage;
                    this.cameraPreview.style.display = 'block';
                    this.captureBtn.style.display = 'none';
                    this.retakeBtn.style.display = 'flex';

                    this.cleanupCamera();
                };

                reader.readAsDataURL(file);
            }
        };

        input.click();
    }

    async base64ToBlob(base64, mimeType) {
        const response = await fetch(base64);
        return await response.blob();
    }

    cleanupCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const cameraManager = new OCRCameraManager();

    window.OCRCameraManager = cameraManager;

    window.addEventListener('unload', () => {
        cameraManager.cleanupCamera();
    });
});