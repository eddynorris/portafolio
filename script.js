// ===== VARIABLES GLOBALES =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const scrollTopBtn = document.getElementById('scroll-top');
const chatbotButton = document.getElementById('chatbot-button');
const chatbotPanel = document.getElementById('chatbot-panel');
const chatbotClose = document.getElementById('chatbot-close');
const contactForm = document.getElementById('contact-form');

// Variables para el modo toggle
const modeToggle = document.getElementById('mode-toggle');
const toggleIcon = document.getElementById('toggle-icon');
const toggleLabel = document.getElementById('toggle-label');
// const transitionOverlay = document.getElementById('transition-overlay'); // Legacy
const logoAccent = document.getElementById('logo-accent');

// Estado actual del modo
let isEsportsMode = false;

// ===== ADVANCED MODE TOGGLE SYSTEM =====
// Función principal para cambiar de modo con animación avanzada
function toggleMode() {
    // Referencias al nuevo sistema avanzado
    const advancedTransition = document.getElementById('advanced-transition');
    const modeIcon = document.getElementById('transition-mode-icon');
    const modeText = document.getElementById('transition-mode-text');
    const loadingProgress = document.getElementById('loading-progress');
    
    // Activar overlay avanzado
    advancedTransition.classList.add('active');
    
    // Reiniciar animación de loading
    loadingProgress.style.animation = 'none';
    loadingProgress.offsetHeight; // Trigger reflow
    loadingProgress.style.animation = 'loadingProgress 2s ease-in-out';
    
    // Cambiar el estado
    isEsportsMode = !isEsportsMode;
    
    // Fase 1: Inicio de la transición (0.5s)
    setTimeout(() => {
        // Neural network activation
        triggerNeuralActivation();
        
        // Cambiar contenido de la transición
        if (isEsportsMode) {
            modeIcon.innerHTML = '<i class="fas fa-gamepad"></i>';
            modeText.textContent = 'ESPORTS MODE';
        } else {
            modeIcon.innerHTML = '<i class="fas fa-microchip"></i>';
            modeText.textContent = 'ENGINEER MODE';
        }
    }, 500);
    
    // Fase 2: Cambio de modo (1s)
    setTimeout(() => {
        // Cambiar el body class y elementos
        if (isEsportsMode) {
            document.body.classList.add('esports-mode');
            modeToggle.classList.add('esports-mode');
            toggleIcon.className = 'toggle-icon fas fa-gamepad';
            toggleLabel.textContent = 'Modo Ingeniero';
            logoAccent.textContent = '.GAMER';
            
            // Cambiar título de la página
            document.title = 'Eddy - Pro Gamer & Esports Player';
            
        } else {
            document.body.classList.remove('esports-mode');
            modeToggle.classList.remove('esports-mode');
            toggleIcon.className = 'toggle-icon fas fa-laptop-code';
            toggleLabel.textContent = 'Modo Esports';
            logoAccent.textContent = '.DEV';
            
            // Restaurar título original
            document.title = 'Eddy Portafolio - Ingeniero Informático & Esports Pro';
        }
        
        // Actualizar navegación
        updateNavigation();
        
        // Quantum field distortion
        triggerQuantumDistortion();
        
    }, 1000);
    
    // Fase 3: Reality reconstruction (1.5s)
    setTimeout(() => {
        triggerRealityReconstruction();
        
        // Scroll to top con efecto suave
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    }, 1500);
    
    // Fase 4: Finalización y cierre (2.5s)
    setTimeout(() => {
        advancedTransition.classList.remove('active');
        
        // Ejecutar animaciones de entrada suaves
        triggerElegantContentAnimations();
        
        // Guardar estado en localStorage
        localStorage.setItem('esportsMode', isEsportsMode);
        
    }, 2500);
}

// ===== FUNCIONES DE EFECTOS AVANZADOS =====
function triggerNeuralActivation() {
    const nodes = document.querySelectorAll('.node');
    const connections = document.querySelectorAll('.connection');
    
    nodes.forEach((node, index) => {
        setTimeout(() => {
            node.style.animation = 'none';
            node.offsetHeight;
            node.style.animation = `neuralPulse 0.5s ease-in-out`;
        }, index * 100);
    });
    
    connections.forEach((connection, index) => {
        setTimeout(() => {
            connection.style.animation = 'none';
            connection.offsetHeight;
            connection.style.animation = `neuralFlow 1s ease-in-out`;
        }, index * 200);
    });
}

function triggerQuantumDistortion() {
    const particles = document.querySelectorAll('.quantum-particle');
    
    particles.forEach((particle, index) => {
        setTimeout(() => {
            particle.style.animation = 'none';
            particle.offsetHeight;
            particle.style.animation = `quantumFloat 1s ease-in-out`;
        }, index * 50);
    });
}

function triggerRealityReconstruction() {
    const waves = document.querySelectorAll('.distortion-wave');
    
    waves.forEach((wave, index) => {
        setTimeout(() => {
            wave.style.animation = 'none';
            wave.offsetHeight;
            wave.style.animation = `distortionExpand 1s ease-out`;
        }, index * 300);
    });
    
    // Efecto de data streams
    const streams = document.querySelectorAll('.stream');
    streams.forEach((stream, index) => {
        setTimeout(() => {
            stream.style.animation = 'none';
            stream.offsetHeight;
            stream.style.animation = `dataFlow 1s ease-in-out`;
        }, index * 200);
    });
}

// Crear efecto de explosión de partículas
function createExplosionEffect() {
    const particles = document.querySelectorAll('.explosion-particles');
    particles.forEach((particle, index) => {
        particle.style.background = isEsportsMode ? 'var(--color-accent)' : 'var(--color-primary)';
        particle.style.animationDelay = `${index * 0.05}s`;
        particle.style.animation = 'none';
        
        // Reiniciar animación
        setTimeout(() => {
            particle.style.animation = 'explodeParticle 1s ease-out forwards';
        }, 100);
    });
}

// Función para animaciones de contenido elegantes
function triggerElegantContentAnimations() {
    const visibleSections = document.querySelectorAll('section:not([style*="display: none"])');
    
    visibleSections.forEach((section, index) => {
        // Efecto de entrada elegante
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.filter = 'blur(2px)';
        
        setTimeout(() => {
            section.style.transition = 'all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
            section.style.filter = 'blur(0px)';
            
            // Efecto de brillo suave
            section.style.boxShadow = `0 0 40px ${isEsportsMode ? 'rgba(255, 107, 107, 0.2)' : 'rgba(0, 255, 136, 0.2)'}`;
            
            setTimeout(() => {
                section.style.boxShadow = '';
            }, 500);
            
        }, index * 200 + 300);
    });
    
    // Reset transitions después de las animaciones
    setTimeout(() => {
        visibleSections.forEach(section => {
            section.style.transition = '';
        });
    }, visibleSections.length * 200 + 1500);
}

// Crear ondas de impacto
function createImpactWaves() {
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const wave = document.createElement('div');
            wave.className = 'impact-wave';
            wave.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                width: 10px;
                height: 10px;
                border: 2px solid ${isEsportsMode ? 'var(--color-accent)' : 'var(--color-primary)'};
                border-radius: 50%;
                transform: translate(-50%, -50%);
                animation: impactWave 1s ease-out forwards;
                pointer-events: none;
                z-index: 9998;
            `;
            
            document.body.appendChild(wave);
            
            setTimeout(() => {
                wave.remove();
            }, 1000);
        }, i * 200);
    }
}

// Función para actualizar la navegación según el modo
function updateNavigation() {
    const engineerLinks = document.querySelectorAll('.engineer-only');
    const esportsLinks = document.querySelectorAll('.esports-only');
    
    if (isEsportsMode) {
        // Ocultar enlaces de ingeniero
        engineerLinks.forEach(link => {
            if (link.classList.contains('nav-link')) {
                link.style.display = 'none';
            }
        });
        
        // Mostrar enlaces de esports
        esportsLinks.forEach(link => {
            if (link.classList.contains('nav-link')) {
                link.style.display = 'block';
            }
        });
    } else {
        // Mostrar enlaces de ingeniero
        engineerLinks.forEach(link => {
            if (link.classList.contains('nav-link')) {
                link.style.display = 'block';
            }
        });
        
        // Ocultar enlaces de esports
        esportsLinks.forEach(link => {
            if (link.classList.contains('nav-link')) {
                link.style.display = 'none';
            }
        });
    }
}


// Event listener para el botón toggle
modeToggle.addEventListener('click', toggleMode);

// Función para guardar el estado del modo
function saveModeState() {
    localStorage.setItem('portfolioMode', isEsportsMode ? 'esports' : 'engineer');
}

// Función para cargar el estado del modo
function loadModeState() {
    const savedMode = localStorage.getItem('portfolioMode');
    if (savedMode === 'esports') {
        // Cambiar a modo esports sin animación al cargar
        isEsportsMode = true;
        document.body.classList.add('esports-mode');
        modeToggle.classList.add('esports-mode');
        toggleIcon.className = 'toggle-icon fas fa-gamepad';
        toggleLabel.textContent = 'Modo Ingeniero';
        logoAccent.textContent = '.GAMER';
        document.title = 'Eddy - Pro Gamer & Esports Player';
        updateNavigation();
    }
}

// Efecto de sonido simulado para el cambio de modo
function playToggleSound() {
    // Crear contexto de audio para efecto de sonido
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = isEsportsMode ? 800 : 400;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            // Silenciar errores de audio en navegadores que no lo soporten
        }
    }
}

// Modificar la función toggleMode para incluir el sonido y persistencia
const originalToggleMode = toggleMode;
toggleMode = function() {
    playToggleSound();
    originalToggleMode();
    saveModeState();
};

// Atajo de teclado para cambiar modo (Ctrl + M)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMode();
        showNotification(`Cambiado a modo ${isEsportsMode ? 'Esports' : 'Ingeniero'}`, 'info');
    }
});

// ===== NAVEGACIÓN =====
// Toggle del menú móvil
navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
    document.body.classList.toggle('nav-open');
});

// Cerrar menú al hacer click en un enlace
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('nav-open');
    });
});

// Navbar al hacer scroll
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
        scrollTopBtn.classList.add('visible');
    } else {
        navbar.classList.remove('scrolled');
        scrollTopBtn.classList.remove('visible');
    }
});

// ===== SMOOTH SCROLL =====
// Smooth scroll para enlaces internos
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80; // Compensar altura del navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Scroll to top button
scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ===== ANIMACIONES SCROLL =====
// Intersection Observer para animaciones al hacer scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
            
            // Animaciones específicas por tipo de elemento
            if (entry.target.classList.contains('skill-category')) {
                animateSkillBars(entry.target);
            }
            
            if (entry.target.classList.contains('cyberpunk-interface') || entry.target.classList.contains('cyberpunk-interface-new')) {
                animateCyberpunkSkills(entry.target);
            }
            
            if (entry.target.classList.contains('stat-item')) {
                animateCounter(entry.target);
            }
            
            if (entry.target.classList.contains('project-card')) {
                entry.target.style.animationDelay = `${Math.random() * 0.5}s`;
            }
        }
    });
}, observerOptions);

// Observar elementos para animaciones
const elementsToAnimate = document.querySelectorAll(`
    .hero-content,
    .about-text,
    .about-image,
    .skill-category,
    .cyberpunk-skills,
    .project-card,
    .service-card,
    .esports-story,
    .esports-gallery,
    .esports-achievements,
    .achievement-item,
    .stat-item
`);

elementsToAnimate.forEach(el => observer.observe(el));

// ===== ANIMACIÓN DE BARRAS DE HABILIDADES =====
function animateSkillBars(skillCategory) {
    const skillItems = skillCategory.querySelectorAll('.skill-item');
    skillItems.forEach((item, index) => {
        setTimeout(() => {
            item.style.transform = 'translateX(0)';
            item.style.opacity = '1';
        }, index * 100);
    });
}

// ===== CYBERPUNK SKILLS INTERACTIVITY =====
const skillsData = {
    frontend: {
        name: "FRONTEND",
        level: 20,
        description: "El Frontend determina tu capacidad para crear interfaces modernas y experiencias de usuario excepcionales.",
        bonuses: [
            "Aumenta en un 20% la velocidad de desarrollo",
            "Mejora en un 15% la optimización de rendimiento", 
            "Reduce en un 30% los bugs de UI/UX",
            "Aumenta la compatibilidad cross-browser",
            "Mejora la accesibilidad web"
        ],
        related: [
            { name: "React/Vue", level: 8 },
            { name: "TypeScript", level: 6 }
        ]
    },
    backend: {
        name: "BACKEND",
        level: 18,
        description: "El Backend define tu maestría en arquitectura de servidores y APIs robustas.",
        bonuses: [
            "Aumenta en un 25% la eficiencia de APIs",
            "Mejora en un 20% la seguridad del sistema",
            "Reduce en un 35% los tiempos de respuesta",
            "Aumenta la escalabilidad del servidor",
            "Mejora el manejo de bases de datos"
        ],
        related: [
            { name: "Node.js", level: 7 },
            { name: "Python", level: 9 }
        ]
    },
    ia: {
        name: "IA & RAG",
        level: 22,
        description: "La IA determina tu capacidad de crear sistemas inteligentes y procesamiento de datos avanzado.",
        bonuses: [
            "Aumenta en un 15% la eficiencia de procesamiento",
            "Mejora en un 25% la precisión de respuestas",
            "Reduce en un 30% el tiempo de entrenamiento", 
            "Aumenta la capacidad de RAG avanzado",
            "Mejora la integración con LLMs"
        ],
        related: [
            { name: "Machine Learning", level: 5 },
            { name: "Data Processing", level: 4 }
        ]
    },
    automation: {
        name: "AUTOMATIZACIÓN",
        level: 24,
        description: "La Automatización define tu habilidad para optimizar procesos y crear flujos de trabajo inteligentes.",
        bonuses: [
            "Aumenta en un 40% la eficiencia de procesos",
            "Mejora en un 30% la reducción de tareas manuales",
            "Reduce en un 50% los errores humanos",
            "Aumenta la integración entre sistemas",
            "Mejora el monitoring automático"
        ],
        related: [
            { name: "n8n Workflows", level: 9 },
            { name: "Scripts", level: 8 }
        ]
    },
    database: {
        name: "DATABASES",
        level: 16,
        description: "Las Databases determinan tu capacidad para diseñar y optimizar sistemas de almacenamiento de datos.",
        bonuses: [
            "Aumenta en un 20% la velocidad de consultas",
            "Mejora en un 25% la integridad de datos",
            "Reduce en un 30% el uso de recursos",
            "Aumenta la capacidad de análisis",
            "Mejora la replicación y backup"
        ],
        related: [
            { name: "SQL", level: 6 },
            { name: "NoSQL", level: 4 }
        ]
    },
    cloud: {
        name: "CLOUD",
        level: 19,
        description: "El Cloud define tu experticia en arquitecturas distribuidas y servicios en la nube.",
        bonuses: [
            "Aumenta en un 30% la escalabilidad",
            "Mejora en un 25% la disponibilidad",
            "Reduce en un 40% los costos de infraestructura",
            "Aumenta la seguridad en la nube",
            "Mejora el deployment automático"
        ],
        related: [
            { name: "AWS/Azure", level: 7 },
            { name: "Docker", level: 5 }
        ]
    }
};

function initCyberpunkSkills() {
    // Buscar tanto hex-skills como skill-cards para compatibilidad
    const hexSkills = document.querySelectorAll('.hex-skill');
    const skillCards = document.querySelectorAll('.skill-card');
    const allSkills = [...hexSkills, ...skillCards];
    
    // Marcar la primera skill como seleccionada por defecto (IA & RAG)
    const defaultSkill = document.querySelector('[data-skill="ia"]');
    if (defaultSkill) {
        defaultSkill.classList.add('selected', 'active');
        updateSkillDetails('ia');
    }
    
    allSkills.forEach(skill => {
        skill.addEventListener('click', () => {
            // Remover selección anterior de todos los elementos
            allSkills.forEach(s => {
                s.classList.remove('selected', 'active');
            });
            
            // Agregar selección actual
            skill.classList.add('selected', 'active');
            
            // Actualizar panel de detalles
            const skillType = skill.dataset.skill;
            updateSkillDetails(skillType);
        });
        
        skill.addEventListener('mouseenter', () => {
            // Solo cambiar info en hover si no está activa
            if (!skill.classList.contains('active')) {
                const skillType = skill.dataset.skill;
                updateSkillDetails(skillType);
            }
        });
    });
}

function updateSkillDetails(skillType) {
    const data = skillsData[skillType];
    if (!data) return;
    
    // Actualizar elementos del panel
    document.getElementById('skill-level-num').textContent = data.level;
    document.getElementById('skill-title').textContent = data.name;
    document.getElementById('skill-description').textContent = data.description;
    
    // Actualizar bonuses
    const bonusesContainer = document.getElementById('skill-bonuses');
    bonusesContainer.innerHTML = data.bonuses.map(bonus => 
        `<div class="bonus-item">${bonus}</div>`
    ).join('');
    
    // Actualizar skills relacionadas
    const relatedContainer = document.getElementById('related-skills');
    relatedContainer.innerHTML = data.related.map(skill =>
        `<div class="related-skill">
            <span class="related-name">${skill.name}</span>
            <span class="related-level">${skill.level}</span>
        </div>`
    ).join('');
    
    // Animar actualización
    const panel = document.getElementById('selected-skill');
    panel.style.transform = 'scale(0.98)';
    setTimeout(() => {
        panel.style.transform = 'scale(1)';
    }, 150);
}

// ===== ANIMACIÓN DE SISTEMA CYBERPUNK =====
function animateCyberpunkSkills(skillsContainer) {
    const hexSkills = document.querySelectorAll('.hex-skill');
    const skillCards = document.querySelectorAll('.skill-card');
    const techGridContainer = document.querySelector('.tech-grid-container');
    
    // Animar hexágonos (si existen)
    hexSkills.forEach((skill, index) => {
        setTimeout(() => {
            const point = skill.querySelector('.hex-point');
            const label = skill.querySelector('.hex-label');
            
            if (point) {
                point.style.transform = 'scale(1.1)';
                point.style.boxShadow = '0 0 15px var(--color-primary)';
            }
            
            if (label) {
                label.style.opacity = '1';
                label.style.transform = 'translateX(-50%) translateY(0)';
            }
            
        }, index * 200 + 300);
    });
    
    // Animar skill cards (diseño nuevo)
    skillCards.forEach((card, index) => {
        // Estado inicial
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px) scale(0.9)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0) scale(1)';
            
            // Animar progress bar
            const progressFill = card.querySelector('.progress-fill');
            if (progressFill) {
                const width = progressFill.style.width;
                progressFill.style.width = '0%';
                setTimeout(() => {
                    progressFill.style.width = width;
                }, 300);
            }
            
        }, index * 150 + 400);
    });
    
    // Animar tech grid header
    if (techGridContainer) {
        const header = techGridContainer.querySelector('.tech-grid-header');
        const footer = techGridContainer.querySelector('.tech-grid-footer');
        
        if (header) {
            header.style.opacity = '0';
            header.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                header.style.transition = 'all 0.6s ease';
                header.style.opacity = '1';
                header.style.transform = 'translateY(0)';
            }, 200);
        }
        
        if (footer) {
            footer.style.opacity = '0';
            setTimeout(() => {
                footer.style.transition = 'all 0.6s ease';
                footer.style.opacity = '1';
            }, 1200);
        }
    }
    
    // Inicializar interactividad
    setTimeout(() => {
        initCyberpunkSkills();
    }, 1000);
}

// ===== ANIMACIÓN DE CONTADORES =====
function animateCounter(statItem) {
    const numberElement = statItem.querySelector('.stat-number');
    const targetNumber = parseInt(numberElement.textContent);
    const duration = 2000; // 2 segundos
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Usar easing para una animación más suave
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentNumber = Math.floor(targetNumber * easeOutQuart);
        
        numberElement.textContent = currentNumber + '+';
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            numberElement.textContent = targetNumber + '+';
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// ===== EFECTOS DE PARALLAX =====
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const rate = scrolled * -0.5;
    
    // Parallax para elementos flotantes
    const floatingElements = document.querySelectorAll('.float-item');
    floatingElements.forEach(element => {
        const speed = element.dataset.speed || 1;
        const yPos = -(scrolled * speed * 0.1);
        element.style.transform = `translateY(${yPos}px)`;
    });
    
    // Parallax para hero background
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.transform = `translateY(${rate}px)`;
    }
});

// ===== TYPEWRITER EFFECT =====
class TypeWriter {
    constructor(txtElement, words, wait = 3000) {
        this.txtElement = txtElement;
        this.words = words;
        this.txt = '';
        this.wordIndex = 0;
        this.wait = parseInt(wait, 10);
        this.type();
        this.isDeleting = false;
    }
    
    type() {
        const current = this.wordIndex % this.words.length;
        const fullTxt = this.words[current];
        
        if (this.isDeleting) {
            this.txt = fullTxt.substring(0, this.txt.length - 1);
        } else {
            this.txt = fullTxt.substring(0, this.txt.length + 1);
        }
        
        this.txtElement.innerHTML = `<span class="txt">${this.txt}</span>`;
        
        let typeSpeed = 100;
        
        if (this.isDeleting) {
            typeSpeed /= 2;
        }
        
        if (!this.isDeleting && this.txt === fullTxt) {
            typeSpeed = this.wait;
            this.isDeleting = true;
        } else if (this.isDeleting && this.txt === '') {
            this.isDeleting = false;
            this.wordIndex++;
            typeSpeed = 500;
        }
        
        setTimeout(() => this.type(), typeSpeed);
    }
}

// Inicializar typewriter para el subtítulo del hero
document.addEventListener('DOMContentLoaded', () => {
    const txtElement = document.querySelector('.hero-subtitle');
    if (txtElement) {
        const words = [
            'Transformando ideas en soluciones digitales innovadoras con IA y automatización',
            'De las batallas virtuales a los desafíos del código',
            'Creando experiencias web excepcionales con tecnologías modernas'
        ];
        new TypeWriter(txtElement, words, 4000);
    }
});

// ===== CHATBOT WIDGET =====
chatbotButton.addEventListener('click', () => {
    chatbotPanel.classList.toggle('active');
});

chatbotClose.addEventListener('click', () => {
    chatbotPanel.classList.remove('active');
});

// Cerrar chatbot al hacer click fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.chatbot-widget')) {
        chatbotPanel.classList.remove('active');
    }
});

// ===== FORMULARIO DE CONTACTO =====
contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Obtener datos del formulario
    const formData = new FormData(contactForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const subject = formData.get('subject');
    const message = formData.get('message');
    
    // Cambiar texto del botón
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    submitButton.disabled = true;
    
    try {
        // Enviar email usando EmailJS (servicio gratuito para envío de emails desde frontend)
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                service_id: 'service_eddy_portfolio', // Tendrás que crear este servicio en EmailJS
                template_id: 'template_contact_form', // Tendrás que crear este template
                user_id: 'your_emailjs_public_key', // Tu clave pública de EmailJS
                template_params: {
                    from_name: name,
                    from_email: email,
                    subject: subject,
                    message: message,
                    to_email: 'eddy.sagitario.97@gmail.com'
                }
            })
        });

        if (response.ok) {
            // Mostrar mensaje de éxito
            showNotification('¡Mensaje enviado con éxito! Te contactaré pronto.', 'success');
            
            // Limpiar formulario
            contactForm.reset();
            
            // Resetear etiquetas de formulario
            const labels = contactForm.querySelectorAll('label');
            labels.forEach(label => {
                label.style.top = '1rem';
                label.style.color = 'var(--text-muted)';
                label.style.fontSize = '1rem';
            });
        } else {
            throw new Error('Error en el envío');
        }
        
    } catch (error) {
        // Fallback: usar mailto como alternativa
        const mailtoLink = `mailto:eddy.sagitario.97@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`
Nombre: ${name}
Email: ${email}

Mensaje:
${message}
        `)}`;
        
        window.location.href = mailtoLink;
        showNotification('Se abrirá tu cliente de email para completar el envío', 'info');
        
        // Limpiar formulario
        contactForm.reset();
        
        // Resetear etiquetas de formulario
        const labels = contactForm.querySelectorAll('label');
        labels.forEach(label => {
            label.style.top = '1rem';
            label.style.color = 'var(--text-muted)';
            label.style.fontSize = '1rem';
        });
        
    } finally {
        // Restaurar botón
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// ===== SISTEMA DE NOTIFICACIONES =====
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Agregar estilos si no existen
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 100px;
                right: 20px;
                background: var(--bg-card);
                border: 1px solid var(--color-primary);
                border-radius: 10px;
                padding: 1rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                z-index: 10000;
                min-width: 300px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                transform: translateX(400px);
                transition: transform 0.3s ease-out;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification-success {
                border-color: var(--color-primary);
                color: var(--color-primary);
            }
            
            .notification-error {
                border-color: var(--color-accent);
                color: var(--color-accent);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                padding: 0;
                font-size: 1rem;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            
            .notification-close:hover {
                opacity: 1;
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Manejar cierre
    const closeBtn = notification.querySelector('.notification-close');
    const closeNotification = () => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    };
    
    closeBtn.addEventListener('click', closeNotification);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(closeNotification, 5000);
}

// ===== EFECTOS DE CURSOR PERSONALIZADO =====
// Crear cursor personalizado para la sección de esports
function createCustomCursor() {
    const cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    cursor.innerHTML = '<i class="fas fa-gamepad"></i>';
    
    const styles = document.createElement('style');
    styles.textContent = `
        #custom-cursor {
            position: fixed;
            width: 30px;
            height: 30px;
            background: var(--color-accent);
            border-radius: 50%;
            pointer-events: none;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.3s, transform 0.1s;
            transform: translate(-50%, -50%);
        }
        
        .esports.cursor-active #custom-cursor {
            opacity: 1;
        }
        
        .esports.cursor-active {
            cursor: none;
        }
    `;
    
    document.head.appendChild(styles);
    document.body.appendChild(cursor);
    
    // Mover cursor
    let mouseX = 0, mouseY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
    });
    
    // Activar en sección esports
    const esportsSection = document.querySelector('.esports');
    if (esportsSection) {
        esportsSection.addEventListener('mouseenter', () => {
            esportsSection.classList.add('cursor-active');
        });
        
        esportsSection.addEventListener('mouseleave', () => {
            esportsSection.classList.remove('cursor-active');
        });
    }
}

// ===== EFECTOS DE PARTÍCULAS =====
class ParticleSystem {
    constructor(container) {
        this.container = container;
        this.particles = [];
        this.init();
    }
    
    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1';
        
        this.container.appendChild(this.canvas);
        this.container.style.position = 'relative';
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // Crear partículas iniciales
        for (let i = 0; i < 20; i++) {
            this.createParticle();
        }
        
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = this.container.offsetWidth;
        this.canvas.height = this.container.offsetHeight;
    }
    
    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 1,
            opacity: Math.random() * 0.5 + 0.2,
            color: Math.random() > 0.5 ? '#00ff88' : '#00d4ff'
        };
    }
    
    updateParticle(particle) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Wrap around edges
        if (particle.x < 0) particle.x = this.canvas.width;
        if (particle.x > this.canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = this.canvas.height;
        if (particle.y > this.canvas.height) particle.y = 0;
    }
    
    drawParticle(particle) {
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.ctx.fillStyle = particle.color;
        this.ctx.globalAlpha = particle.opacity;
        this.ctx.fill();
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Asegurarse de tener el número correcto de partículas
        while (this.particles.length < 20) {
            this.particles.push(this.createParticle());
        }
        
        this.particles.forEach(particle => {
            this.updateParticle(particle);
            this.drawParticle(particle);
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

// ===== MANEJO DE ARCHIVOS CV =====
// Simular descarga de CV
const downloadButtons = document.querySelectorAll('#download-cv, #footer-cv');
downloadButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Aquí puedes poner la URL real de tu CV
        // const cvUrl = 'path/to/your/cv.pdf';
        
        // Por ahora, mostrar notificación
        showNotification('CV descargado exitosamente', 'success');
        
        // Ejemplo de cómo sería la descarga real:
        /*
        const link = document.createElement('a');
        link.href = cvUrl;
        link.download = 'CV-Eddy-Ingeniero-Informatico.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        */
    });
});

// ===== LAZY LOADING DE IMÁGENES =====
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src || img.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
        }
    });
});

// Observar todas las imágenes
document.querySelectorAll('img').forEach(img => {
    imageObserver.observe(img);
});

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    // Remover cortinas iniciales después de la animación
    setTimeout(() => {
        const initialCurtainLeft = document.getElementById('initial-curtain-left');
        const initialCurtainRight = document.getElementById('initial-curtain-right');
        
        if (initialCurtainLeft) initialCurtainLeft.remove();
        if (initialCurtainRight) initialCurtainRight.remove();
    }, 3000); // 2.5s animation + 0.5s delay

    // Cargar estado del modo guardado
    loadModeState();
    
    // Inicializar sistema de habilidades Cyberpunk
    setTimeout(() => {
        initCyberpunkSkills();
    }, 1000);
    
    // Crear cursor personalizado
    createCustomCursor();
    
    // Inicializar sistema de partículas en la sección hero
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        new ParticleSystem(heroSection);
    }
    
    // Agregar clase de carga completada
    document.body.classList.add('loaded');
    
    // Inicializar animaciones CSS personalizadas
    const style = document.createElement('style');
    style.textContent = `
        .loaded .hero-content {
            animation: fadeInUp 1s ease-out;
        }
        
        .loaded .floating-elements .float-item {
            animation: float 6s ease-in-out infinite;
        }
        
        .skill-item {
            transform: translateX(-20px);
            opacity: 0;
            transition: all 0.5s ease;
        }
        
        .animate .skill-item {
            transform: translateX(0);
            opacity: 1;
        }
        
        .project-card {
            transform: translateY(30px);
            opacity: 0;
            transition: all 0.6s ease;
        }
        
        .animate.project-card {
            transform: translateY(0);
            opacity: 1;
        }
        
        .service-card {
            transform: scale(0.9);
            opacity: 0;
            transition: all 0.5s ease;
        }
        
        .animate.service-card {
            transform: scale(1);
            opacity: 1;
        }
        
        .achievement-item {
            transform: rotateY(45deg);
            opacity: 0;
            transition: all 0.6s ease;
        }
        
        .animate.achievement-item {
            transform: rotateY(0deg);
            opacity: 1;
        }
        
        @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Mostrar notificación de ayuda para el atajo de teclado
    setTimeout(() => {
        showNotification('💡 Tip: Presiona Ctrl+M para cambiar entre modos rápidamente', 'info');
    }, 3000);
    
    console.log(`🎮 Portafolio Eddy cargado exitosamente!
    ${isEsportsMode ? '🏆 Modo Esports activado' : '💻 Modo Ingeniero activado'}
    
    Atajos de teclado:
    - Ctrl+M: Cambiar modo
    - ↑↑↓↓←→←→BA: Easter egg`);
});

// ===== EASTER EGGS =====
// Konami Code para easter egg
const konamiCode = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
    if (e.code === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            // Easter egg activado
            activateGamerMode();
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

function activateGamerMode() {
    document.body.classList.add('gamer-mode');
    
    const style = document.createElement('style');
    style.textContent = `
        .gamer-mode {
            filter: hue-rotate(45deg) saturate(1.5);
        }
        
        .gamer-mode .hero {
            background: radial-gradient(ellipse at center, rgba(255, 107, 107, 0.2) 0%, transparent 70%),
                        radial-gradient(ellipse at 80% 20%, rgba(255, 182, 77, 0.2) 0%, transparent 50%);
        }
        
        .gamer-mode .section-title::after {
            background: linear-gradient(135deg, #ff6b6b 0%, #ffb74d 100%);
        }
    `;
    document.head.appendChild(style);
    
    showNotification('🎮 ¡Modo Gamer Activado! ¡GG WP!', 'success');
    
    // Desactivar después de 10 segundos
    setTimeout(() => {
        document.body.classList.remove('gamer-mode');
        showNotification('Modo normal restaurado', 'info');
    }, 10000);
}

// Console art
console.log(`
    ███████╗██████╗ ██████╗ ██╗   ██╗
    ██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝
    █████╗  ██║  ██║██║  ██║ ╚████╔╝ 
    ██╔══╝  ██║  ██║██║  ██║  ╚██╔╝  
    ███████╗██████╔╝██████╔╝   ██║   
    ╚══════╝╚═════╝ ╚═════╝    ╚═╝   
                                      
    🎮 Ingeniero Informático & Esports Pro
    💻 Desarrollador Web & IA Specialist
    
    ¿Te gusta el dota? Hablemos!
`);