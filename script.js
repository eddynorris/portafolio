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
const logoAccent = document.getElementById('logo-accent');

// Estado actual del modo
let isEsportsMode = false;

// ===== ADVANCED MODE TOGGLE SYSTEM =====
// Función principal para cambiar de modo con animación avanzada
function toggleMode() {
    const advancedTransition = document.getElementById('advanced-transition');
    const modeIcon = document.getElementById('transition-mode-icon');
    const modeText = document.getElementById('transition-mode-text');
    const loadingProgress = document.getElementById('loading-progress');
    
    advancedTransition.classList.add('active');
    
    loadingProgress.style.animation = 'none';
    loadingProgress.offsetHeight; 
    loadingProgress.style.animation = 'loadingProgress 2s ease-in-out';
    
    isEsportsMode = !isEsportsMode;
    
    setTimeout(() => {
        triggerNeuralActivation();
        if (isEsportsMode) {
            modeIcon.innerHTML = '<i class="fas fa-gamepad"></i>';
            modeText.textContent = 'ESPORTS MODE';
        } else {
            modeIcon.innerHTML = '<i class="fas fa-microchip"></i>';
            modeText.textContent = 'ENGINEER MODE';
        }
    }, 500);
    
    setTimeout(() => {
        if (isEsportsMode) {
            document.body.classList.add('esports-mode');
            modeToggle.classList.add('esports-mode');
            toggleIcon.className = 'toggle-icon fas fa-gamepad';
            toggleLabel.textContent = 'Modo Ingeniero';
            logoAccent.textContent = '.GAMER';
            document.title = 'Eddy Orosco - Pro Gamer & Team Captain';
        } else {
            document.body.classList.remove('esports-mode');
            modeToggle.classList.remove('esports-mode');
            toggleIcon.className = 'toggle-icon fas fa-laptop-code';
            toggleLabel.textContent = 'Modo Esports';
            logoAccent.textContent = '.DEV';
            document.title = 'Eddy Orosco Portafolio - Ingeniero de Software & Analista de Videojuegos';
        }
        
        updateNavigation();
        triggerQuantumDistortion();
    }, 1000);
    
    setTimeout(() => {
        triggerRealityReconstruction();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1500);
    
    setTimeout(() => {
        advancedTransition.classList.remove('active');
        triggerElegantContentAnimations();
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
    const streams = document.querySelectorAll('.stream');
    streams.forEach((stream, index) => {
        setTimeout(() => {
            stream.style.animation = 'none';
            stream.offsetHeight;
            stream.style.animation = `dataFlow 1s ease-in-out`;
        }, index * 200);
    });
}

function triggerElegantContentAnimations() {
    const visibleSections = document.querySelectorAll('section:not([style*="display: none"])');
    visibleSections.forEach((section, index) => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.filter = 'blur(2px)';
        setTimeout(() => {
            section.style.transition = 'all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
            section.style.filter = 'blur(0px)';
            section.style.boxShadow = `0 0 40px ${isEsportsMode ? 'rgba(255, 107, 107, 0.2)' : 'rgba(0, 255, 136, 0.2)'}`;
            setTimeout(() => {
                section.style.boxShadow = '';
            }, 500);
        }, index * 200 + 300);
    });
    setTimeout(() => {
        visibleSections.forEach(section => {
            section.style.transition = '';
        });
    }, visibleSections.length * 200 + 1500);
}

function updateNavigation() {
    const engineerLinks = document.querySelectorAll('.nav-menu .engineer-only');
    const esportsLinks = document.querySelectorAll('.nav-menu .esports-only');
    if (isEsportsMode) {
        engineerLinks.forEach(link => link.style.display = 'none');
        esportsLinks.forEach(link => link.style.display = 'block');
    } else {
        engineerLinks.forEach(link => link.style.display = 'block');
        esportsLinks.forEach(link => link.style.display = 'none');
    }
}

modeToggle.addEventListener('click', toggleMode);

function saveModeState() {
    localStorage.setItem('portfolioMode', isEsportsMode ? 'esports' : 'engineer');
}

function loadModeState() {
    const savedMode = localStorage.getItem('portfolioMode');
    if (savedMode === 'esports') {
        isEsportsMode = true;
        document.body.classList.add('esports-mode');
        modeToggle.classList.add('esports-mode');
        toggleIcon.className = 'toggle-icon fas fa-gamepad';
        toggleLabel.textContent = 'Modo Ingeniero';
        logoAccent.textContent = '.GAMER';
        document.title = 'Eddy Orosco - Pro Gamer & Team Captain';
        updateNavigation();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMode();
        showNotification(`Cambiado a modo ${isEsportsMode ? 'Esports' : 'Ingeniero'}`, 'info');
    }
});

// ===== NAVEGACIÓN =====
navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
    document.body.classList.toggle('nav-open');
});

const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('nav-open');
    });
});

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
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ===== ANIMACIONES SCROLL =====
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
            
            // Animaciones específicas por tipo de elemento
            if (entry.target.classList.contains('stat-item')) {
                animateCounter(entry.target);
            } else if (entry.target.classList.contains('service-item')) {
                animateServiceItem(entry.target);
            } else if (entry.target.classList.contains('hex-skill')) {
                animateHexSkill(entry.target);
            }
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

const elementsToAnimate = document.querySelectorAll('.hero-content, .about-text, .project-card, .service-card, .esports-story, .achievement-item, .stat-item, .service-item, .hex-skill');
elementsToAnimate.forEach(el => observer.observe(el));

// Función para animar service items
function animateServiceItem(serviceItem) {
    serviceItem.style.transform = 'translateY(20px)';
    serviceItem.style.opacity = '0';
    
    setTimeout(() => {
        serviceItem.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        serviceItem.style.transform = 'translateY(0)';
        serviceItem.style.opacity = '1';
        
        // Efecto de pulso sutil
        setTimeout(() => {
            serviceItem.style.transform = 'scale(1.02)';
            setTimeout(() => {
                serviceItem.style.transform = 'scale(1)';
            }, 150);
        }, 300);
    }, 100);
}

// Función para animar hex skills
function animateHexSkill(hexSkill) {
    const hexNode = hexSkill.querySelector('.hex-node');
    const hexLabel = hexSkill.querySelector('.hex-label');
    
    hexNode.style.transform = 'scale(0) rotate(180deg)';
    hexNode.style.opacity = '0';
    hexLabel.style.transform = 'translateY(10px)';
    hexLabel.style.opacity = '0';
    
    setTimeout(() => {
        hexNode.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        hexLabel.style.transition = 'all 0.6s ease-out';
        
        hexNode.style.transform = 'scale(1) rotate(0deg)';
        hexNode.style.opacity = '1';
        
        setTimeout(() => {
            hexLabel.style.transform = 'translateY(0)';
            hexLabel.style.opacity = '1';
        }, 200);
    }, Math.random() * 200 + 100);
}


// ===== CYBERPUNK SKILLS INTERACTIVITY =====
const skillsData = {
    frontend: { name: "FRONTEND", level: 20, description: "Capacidad para crear interfaces modernas y experiencias de usuario excepcionales.", bonuses: ["+20% velocidad de desarrollo", "+15% optimización de rendimiento", "-30% bugs de UI/UX"], related: [{ name: "React/Angular", level: 8 }, { name: "TypeScript", level: 6 }] },
    backend: { name: "BACKEND", level: 18, description: "Maestría en arquitectura de servidores y APIs robustas.", bonuses: ["+25% eficiencia de APIs", "+20% seguridad del sistema", "-35% tiempos de respuesta"], related: [{ name: "Node.js", level: 7 }, { name: "Python", level: 9 }] },
    ia: { name: "IA & DEV", level: 22, description: "Capacidad de crear sistemas inteligentes y procesamiento de datos avanzado.", bonuses: ["+15% eficiencia de procesamiento", "+25% precisión de respuestas", "-30% tiempo de entrenamiento"], related: [{ name: "Machine Learning", level: 5 }, { name: "Data Processing", level: 4 }] },
    automation: { name: "ARQUITECTURA", level: 24, description: "Habilidad para diseñar sistemas escalables y optimizar flujos de trabajo.", bonuses: ["+40% eficiencia de procesos", "+30% reducción de tareas manuales", "-50% errores humanos"], related: [{ name: "System Design", level: 9 }, { name: "CI/CD", level: 8 }] },
    database: { name: "DATABASES", level: 16, description: "Capacidad para diseñar y optimizar sistemas de almacenamiento de datos.", bonuses: ["+20% velocidad de consultas", "+25% integridad de datos", "-30% uso de recursos"], related: [{ name: "SQL", level: 6 }, { name: "NoSQL", level: 4 }] },
    analysis: { name: "GAME ANALYSIS", level: 19, description: "Experticia en análisis de mecánicas de juego, diseño y UX.", bonuses: ["+30% identificación de patrones", "+25% optimización de UX", "-40% tiempo de análisis"], related: [{ name: "Game Design", level: 7 }, { name: "Player Experience", level: 5 }] }
};

function initCyberpunkSkills() {
    const allSkills = document.querySelectorAll('.hex-skill');
    const defaultSkill = document.querySelector('[data-skill="ia"]');
    
    if (defaultSkill) {
        defaultSkill.classList.add('selected', 'active');
        defaultSkill.setAttribute('aria-selected', 'true');
        defaultSkill.setAttribute('tabindex', '0');
        updateSkillDetails('ia');
    }
    
    allSkills.forEach(skill => {
        // Eventos de click
        skill.addEventListener('click', () => {
            selectSkill(skill, allSkills);
        });
        
        // Eventos de teclado para accesibilidad
        skill.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectSkill(skill, allSkills);
            }
        });
        
        // Microinteracciones mejoradas
        skill.addEventListener('mouseenter', () => {
            if (!skill.classList.contains('active')) {
                skill.style.transform = 'scale(1.05)';
                skill.querySelector('.hex-node').style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.3)';
            }
        });
        
        skill.addEventListener('mouseleave', () => {
            if (!skill.classList.contains('active')) {
                skill.style.transform = '';
                skill.querySelector('.hex-node').style.boxShadow = '';
            }
        });
    });
}

function selectSkill(selectedSkill, allSkills) {
    // Remover estados anteriores
    allSkills.forEach(s => {
        s.classList.remove('selected', 'active');
        s.setAttribute('aria-selected', 'false');
        s.setAttribute('tabindex', '-1');
        s.style.transform = '';
        s.querySelector('.hex-node').style.boxShadow = '';
    });
    
    // Aplicar nuevo estado
    selectedSkill.classList.add('selected', 'active');
    selectedSkill.setAttribute('aria-selected', 'true');
    selectedSkill.setAttribute('tabindex', '0');
    selectedSkill.focus();
    
    // Animación de selección
    selectedSkill.style.transform = 'scale(1.1)';
    setTimeout(() => {
        selectedSkill.style.transform = '';
    }, 200);
    
    updateSkillDetails(selectedSkill.dataset.skill);
}

function updateSkillDetails(skillType) {
    const data = skillsData[skillType];
    if (!data) return;
    
    // Verificar que los elementos existen antes de actualizar
    const skillLevelNum = document.getElementById('skill-level-num');
    const skillTitle = document.getElementById('skill-title-display');
    const skillDescription = document.getElementById('skill-description');
    const skillBonuses = document.getElementById('skill-bonuses');
    
    // Actualizar elementos principales
    if (skillLevelNum) skillLevelNum.textContent = data.level;
    if (skillTitle) skillTitle.textContent = data.name;
    if (skillDescription) skillDescription.textContent = data.description;
    
    // Actualizar bonificaciones - buscar el contenedor ul dentro de skill-bonuses
    if (skillBonuses) {
        const bonusesList = skillBonuses.querySelector('ul');
        if (bonusesList) {
            bonusesList.innerHTML = data.bonuses.map(b => `<li class="bonus-item">${b}</li>`).join('');
        }
    }
    
    // Actualizar habilidades relacionadas - crear la sección si no existe
    let relatedSkillsSection = document.querySelector('.related-skills-integrated');
    if (!relatedSkillsSection) {
        // Crear la sección de habilidades relacionadas
        relatedSkillsSection = document.createElement('section');
        relatedSkillsSection.className = 'related-skills-integrated';
        relatedSkillsSection.innerHTML = `
            <h5>Habilidades Relacionadas</h5>
            <ul id="related-skills" role="list"></ul>
        `;
        // Agregar al final del panel de detalles
        const skillPanel = document.getElementById('selected-skill');
        if (skillPanel) {
            skillPanel.appendChild(relatedSkillsSection);
        }
    }
    
    const relatedSkillsList = document.getElementById('related-skills');
    if (relatedSkillsList) {
        relatedSkillsList.innerHTML = data.related.map(s => 
            `<li class="related-skill">
                <span class="related-name">${s.name}</span>
                <span class="related-level">Nivel ${s.level}</span>
            </li>`
        ).join('');
    }
}


// ===== ANIMACIÓN DE CONTADORES =====
// Función para animar contadores con efectos mejorados
function animateCounter(statItem) {
    const numberElement = statItem.querySelector('.stat-number');
    const targetText = numberElement.textContent;
    
    // Extraer número si existe
    const targetNumber = parseInt(targetText.replace(/\D/g, ''));
    if (isNaN(targetNumber)) return;
    
    // Efecto de entrada
    statItem.style.transform = 'scale(0.8)';
    statItem.style.opacity = '0.7';
    
    setTimeout(() => {
        statItem.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        statItem.style.transform = 'scale(1)';
        statItem.style.opacity = '1';
        
        // Animación del contador
        let currentNumber = 0;
        const increment = targetNumber / 30;
        const timer = setInterval(() => {
            currentNumber += increment;
            if (currentNumber >= targetNumber) {
                numberElement.textContent = targetText;
                clearInterval(timer);
                
                // Efecto de finalización
                statItem.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    statItem.style.transform = 'scale(1)';
                }, 200);
            } else {
                numberElement.textContent = Math.floor(currentNumber) + (targetText.includes('+') ? '+' : '');
            }
        }, 50);
    }, 200);
}

// ===== CHATBOT WIDGET =====
chatbotButton.addEventListener('click', () => chatbotPanel.classList.toggle('active'));
chatbotClose.addEventListener('click', () => chatbotPanel.classList.remove('active'));
document.addEventListener('click', (e) => {
    if (!e.target.closest('.chatbot-widget')) {
        chatbotPanel.classList.remove('active');
    }
});

// Mejorar interactividad de service items
document.addEventListener('DOMContentLoaded', () => {
    const serviceItems = document.querySelectorAll('.service-item');
    
    serviceItems.forEach(item => {
        // Efecto de hover mejorado
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateY(-5px) scale(1.02)';
            item.style.boxShadow = '0 10px 25px rgba(0, 255, 136, 0.15)';
            
            const icon = item.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1.2) rotate(5deg)';
                icon.style.color = 'var(--color-primary)';
            }
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.transform = '';
            item.style.boxShadow = '';
            
            const icon = item.querySelector('i');
            if (icon) {
                icon.style.transform = '';
                icon.style.color = '';
            }
        });
        
        // Efecto de click
        item.addEventListener('click', () => {
            item.style.transform = 'scale(0.95)';
            setTimeout(() => {
                item.style.transform = '';
            }, 150);
        });
        
        // Accesibilidad con teclado
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            }
        });
    });
});

// ===== FORMULARIO DE CONTACTO =====
contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    submitButton.disabled = true;

    // COMENTARIO IMPORTANTE:
    // Para que este formulario funcione, necesitas una cuenta en EmailJS (https://www.emailjs.com/).
    // 1. Crea una cuenta y un servicio de email (ej. Gmail).
    // 2. Crea una plantilla de email con las variables {{from_name}}, {{from_email}}, {{subject}}, {{message}}.
    // 3. Obtén tu Public Key (antes User ID) de la sección "API Keys".
    // 4. Reemplaza 'YOUR_PUBLIC_KEY' abajo con tu clave.
    const emailJsPublicKey = 'YOUR_PUBLIC_KEY'; // <--- REEMPLAZA ESTO

    if (emailJsPublicKey === 'YOUR_PUBLIC_KEY') {
        showNotification('El formulario no está configurado. Contacta por WhatsApp o email.', 'error');
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
        return;
    }

    try {
        const formData = new FormData(contactForm);
        const params = {
            from_name: formData.get('name'),
            from_email: formData.get('email'),
            subject: formData.get('subject'),
            message: formData.get('message'),
        };

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: 'default_service', // O tu ID de servicio
                template_id: 'template_contact_form', // O tu ID de plantilla
                user_id: emailJsPublicKey,
                template_params: params
            })
        });

        if (response.ok) {
            showNotification('¡Mensaje enviado con éxito! Te contactaré pronto.', 'success');
            contactForm.reset();
        } else {
            throw new Error('Error en el envío');
        }
    } catch (error) {
        showNotification('Hubo un error al enviar el mensaje. Por favor, intenta por otro medio.', 'error');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});


// ===== SISTEMA DE NOTIFICACIONES =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i><span>${message}</span><button class="notification-close">&times;</button>`;
    
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification { position: fixed; top: 100px; right: 20px; background: var(--bg-card); border-left: 5px solid; padding: 1rem; border-radius: 8px; z-index: 10000; display: flex; align-items: center; gap: 1rem; box-shadow: 0 5px 15px rgba(0,0,0,0.2); transform: translateX(120%); transition: transform 0.5s ease-in-out; }
            .notification.show { transform: translateX(0); }
            .notification-success { border-color: var(--color-primary); color: var(--text-primary); }
            .notification-error { border-color: var(--color-accent); color: var(--text-primary); }
            .notification-info { border-color: var(--color-secondary); color: var(--text-primary); }
            .notification-close { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem; }`;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);

    const close = () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    };
    notification.querySelector('.notification-close').onclick = close;
    setTimeout(close, 5000);
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const curtains = document.querySelectorAll('.initial-curtain');
        curtains.forEach(c => c.remove());
    }, 2500);

    loadModeState();
    initCyberpunkSkills();
    
    showNotification('💡 Tip: Presiona Ctrl+M para cambiar de modo.', 'info');
    
    console.log("Portafolio de Eddy Orosco cargado. Modo actual:", isEsportsMode ? "Esports" : "Ingeniero");
});