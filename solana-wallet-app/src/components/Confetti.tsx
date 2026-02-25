import { useEffect, useState } from 'react';

interface ConfettiProps {
  active: boolean;
}

export const Confetti = ({ active }: ConfettiProps) => {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    if (active) {
      // Generate 50 confetti particles
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 1,
      }));
      setParticles(newParticles);

      // Clear particles after animation
      const timeout = setTimeout(() => {
        setParticles([]);
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute top-0 w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${particle.left}%`,
            backgroundColor: ['#ff0080', '#00ffff', '#ffff00', '#00ff00', '#ff00ff'][
              Math.floor(Math.random() * 5)
            ],
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

// Add confetti animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes confetti {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(720deg);
      opacity: 0;
    }
  }
  .animate-confetti {
    animation: confetti 3s ease-out forwards;
  }
`;
if (!document.querySelector('style[data-confetti]')) {
  style.setAttribute('data-confetti', 'true');
  document.head.appendChild(style);
}
