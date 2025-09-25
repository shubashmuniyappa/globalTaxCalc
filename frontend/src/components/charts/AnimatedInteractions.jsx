import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import './AnimatedInteractions.css';

// Animated Number Counter
export const AnimatedCounter = ({
  value = 0,
  duration = 2,
  delay = 0,
  format = 'number',
  prefix = '',
  suffix = '',
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const { ref, inView } = useInView({ threshold: 0.5, triggerOnce: true });

  useEffect(() => {
    if (!inView) return;

    const startValue = 0;
    const endValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    const startTime = Date.now() + (delay * 1000);
    const durationMs = duration * 1000;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed < 0) {
        requestAnimationFrame(animate);
        return;
      }

      if (elapsed < durationMs) {
        const progress = elapsed / durationMs;
        const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const currentValue = startValue + (endValue - startValue) * easedProgress;
        setDisplayValue(currentValue);
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    requestAnimationFrame(animate);
  }, [inView, value, duration, delay]);

  const formatValue = (val) => {
    const num = Math.round(val);

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(num);

      case 'percentage':
        return `${num.toFixed(1)}%`;

      case 'number':
      default:
        return new Intl.NumberFormat('en-US').format(num);
    }
  };

  return (
    <motion.span
      ref={ref}
      className={`animated-counter ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, delay }}
    >
      {prefix}{formatValue(displayValue)}{suffix}
    </motion.span>
  );
};

// Animated Progress Bar
export const AnimatedProgressBar = ({
  value = 0,
  max = 100,
  height = 8,
  color = '#3b82f6',
  backgroundColor = '#e5e7eb',
  showLabel = true,
  labelPosition = 'top',
  duration = 1.5,
  delay = 0,
  className = ''
}) => {
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div
      ref={ref}
      className={`animated-progress-container ${className}`}
    >
      {showLabel && labelPosition === 'top' && (
        <div className="progress-label">
          <AnimatedCounter
            value={percentage}
            format="percentage"
            duration={duration}
            delay={delay}
          />
        </div>
      )}

      <div
        className="progress-track"
        style={{
          height: `${height}px`,
          backgroundColor,
          borderRadius: `${height / 2}px`,
          overflow: 'hidden'
        }}
      >
        <motion.div
          className="progress-fill"
          style={{
            height: '100%',
            backgroundColor: color,
            borderRadius: `${height / 2}px`
          }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${percentage}%` } : { width: 0 }}
          transition={{
            duration,
            delay,
            ease: 'easeOut'
          }}
        />
      </div>

      {showLabel && labelPosition === 'bottom' && (
        <div className="progress-label">
          <AnimatedCounter
            value={percentage}
            format="percentage"
            duration={duration}
            delay={delay}
          />
        </div>
      )}
    </div>
  );
};

// Animated Tooltip
export const AnimatedTooltip = ({
  children,
  content,
  position = 'top',
  delay = 0,
  className = '',
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef(null);
  const triggerRef = useRef(null);

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    let x = triggerRect.left + scrollX + triggerRect.width / 2;
    let y = triggerRect.top + scrollY;

    switch (position) {
      case 'top':
        x -= tooltipRect.width / 2;
        y -= tooltipRect.height + 8;
        break;
      case 'bottom':
        x -= tooltipRect.width / 2;
        y += triggerRect.height + 8;
        break;
      case 'left':
        x -= tooltipRect.width + 8;
        y += triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x += triggerRect.width + 8;
        y += triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Keep tooltip within viewport
    const padding = 8;
    const maxX = window.innerWidth - tooltipRect.width - padding;
    const maxY = window.innerHeight - tooltipRect.height - padding;

    x = Math.max(padding, Math.min(x, maxX));
    y = Math.max(padding, Math.min(y, maxY));

    setTooltipPosition({ x, y });
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    setIsVisible(true);
    setTimeout(updatePosition, 10);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`tooltip-trigger ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        {children}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            className={`animated-tooltip tooltip-${position}`}
            style={{
              position: 'fixed',
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              zIndex: 9999
            }}
            initial={{ opacity: 0, scale: 0.8, y: position === 'top' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: position === 'top' ? 10 : -10 }}
            transition={{ duration: 0.2, delay: delay / 1000 }}
          >
            <div className="tooltip-content">
              {content}
            </div>
            <div className={`tooltip-arrow tooltip-arrow-${position}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Hover Scale Effect
export const HoverScale = ({
  children,
  scale = 1.05,
  duration = 0.2,
  className = ''
}) => {
  return (
    <motion.div
      className={`hover-scale ${className}`}
      whileHover={{ scale }}
      whileTap={{ scale: scale * 0.95 }}
      transition={{ duration, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

// Magnetic Effect
export const MagneticEffect = ({
  children,
  strength = 0.3,
  className = ''
}) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (event) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = (event.clientX - centerX) * strength;
    const deltaY = (event.clientY - centerY) * strength;

    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={`magnetic-effect ${className}`}
      style={{ x, y }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
};

// Ripple Effect
export const RippleEffect = ({
  children,
  color = 'rgba(255, 255, 255, 0.3)',
  duration = 0.6,
  className = ''
}) => {
  const [ripples, setRipples] = useState([]);
  const nextRippleId = useRef(0);

  const createRipple = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = {
      id: nextRippleId.current++,
      x,
      y,
      size
    };

    setRipples(prev => [...prev, ripple]);

    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== ripple.id));
    }, duration * 1000);
  };

  return (
    <div
      className={`ripple-container ${className}`}
      onMouseDown={createRipple}
    >
      {children}
      {ripples.map(ripple => (
        <motion.span
          key={ripple.id}
          className="ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
};

// Floating Action Button with Animations
export const AnimatedFAB = ({
  icon,
  label,
  onClick,
  position = 'bottom-right',
  color = '#3b82f6',
  size = 'medium',
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const sizeClasses = {
    small: 'fab-small',
    medium: 'fab-medium',
    large: 'fab-large'
  };

  const positionClasses = {
    'bottom-right': 'fab-bottom-right',
    'bottom-left': 'fab-bottom-left',
    'top-right': 'fab-top-right',
    'top-left': 'fab-top-left'
  };

  return (
    <motion.div
      className={`animated-fab ${sizeClasses[size]} ${positionClasses[position]} ${className}`}
      style={{ backgroundColor: color }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={onClick}
      layout
    >
      <motion.div
        className="fab-content"
        layout
      >
        <motion.div
          className="fab-icon"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {icon}
        </motion.div>

        <AnimatePresence>
          {isExpanded && label && (
            <motion.span
              className="fab-label"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// Pulse Effect
export const PulseEffect = ({
  children,
  color = '#3b82f6',
  size = 1.2,
  duration = 2,
  className = ''
}) => {
  return (
    <div className={`pulse-container ${className}`}>
      <motion.div
        className="pulse-ring"
        style={{
          borderColor: color,
          scale: size
        }}
        animate={{
          scale: [1, size, 1],
          opacity: [0.7, 0, 0.7]
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
      <div className="pulse-content">
        {children}
      </div>
    </div>
  );
};

// Stagger Animation Container
export const StaggerContainer = ({
  children,
  staggerDelay = 0.1,
  duration = 0.6,
  className = ''
}) => {
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        duration
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: 'easeOut'
      }
    }
  };

  return (
    <motion.div
      ref={ref}
      className={`stagger-container ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Particle System Effect
export const ParticleSystem = ({
  particleCount = 50,
  color = '#3b82f6',
  size = 3,
  speed = 1,
  className = ''
}) => {
  const containerRef = useRef(null);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const createParticles = () => {
      const newParticles = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        size: Math.random() * size + 1
      }));
      setParticles(newParticles);
    };

    createParticles();
  }, [particleCount, speed, size]);

  return (
    <div
      ref={containerRef}
      className={`particle-system ${className}`}
    >
      {particles.map(particle => (
        <motion.div
          key={particle.id}
          className="particle"
          style={{
            backgroundColor: color,
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`
          }}
          animate={{
            x: [0, particle.vx * 50, 0],
            y: [0, particle.vy * 50, 0],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}
    </div>
  );
};

export default {
  AnimatedCounter,
  AnimatedProgressBar,
  AnimatedTooltip,
  HoverScale,
  MagneticEffect,
  RippleEffect,
  AnimatedFAB,
  PulseEffect,
  StaggerContainer,
  ParticleSystem
};