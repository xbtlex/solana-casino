import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import {
    TrendingUp,
    Dices,
    CircleDollarSign,
    Target,
    Columns3,
    Spade,
    Grid3X3
} from "lucide-react"

// Game-specific icon mapping with thin strokes
export const GAME_ICONS: Record<string, LucideIcon> = {
    crash: TrendingUp,
    dice: Dices,
    coinflip: CircleDollarSign,
    roulette: Target,
    slots: Columns3,
    blackjack: Spade,
    plinko: Grid3X3
}

interface GameIconProps {
    game: keyof typeof GAME_ICONS | string
    size?: "sm" | "md" | "lg"
    className?: string
    showGlow?: boolean
}

const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
}

const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
}

export const GameIcon = ({ game, size = "md", className = "", showGlow = true }: GameIconProps) => {
    const Icon = GAME_ICONS[game.toLowerCase()] || Dices

    return (
        <motion.div
            className={`
                ${sizeClasses[size]}
                rounded-full
                bg-white/5
                backdrop-blur-md
                border border-white/10
                flex items-center justify-center
                relative
                ${className}
            `}
            whileHover={{
                scale: 1.1,
                boxShadow: "0 0 30px rgba(127, 255, 212, 0.3)"
            }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            {/* Inner glow ring on hover */}
            <motion.div
                className="absolute inset-0 rounded-full"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                style={{
                    background: "radial-gradient(circle, rgba(127,255,212,0.15) 0%, transparent 70%)"
                }}
            />

            <Icon
                size={iconSizes[size]}
                strokeWidth={1.5}
                className={`
                    relative z-10
                    text-[#7fffd4]
                    ${showGlow ? 'icon-glow' : ''}
                `}
            />
        </motion.div>
    )
}

// Standalone icon with glow (for use in headers, etc.)
interface GlowIconProps {
    icon: LucideIcon
    size?: number
    className?: string
    color?: string
}

export const GlowIcon = ({ icon: Icon, size = 20, className = "", color = "#7fffd4" }: GlowIconProps) => {
    return (
        <Icon
            size={size}
            strokeWidth={1.5}
            className={`icon-glow ${className}`}
            style={{ color }}
        />
    )
}

// Glass circle container (without specific icon)
interface IconContainerProps {
    children: React.ReactNode
    size?: "sm" | "md" | "lg"
    className?: string
    glowColor?: string
}

export const IconContainer = ({
    children,
    size = "md",
    className = "",
    glowColor = "rgba(127, 255, 212, 0.3)"
}: IconContainerProps) => {
    return (
        <motion.div
            className={`
                ${sizeClasses[size]}
                rounded-full
                bg-white/5
                backdrop-blur-md
                border border-white/10
                flex items-center justify-center
                relative
                overflow-hidden
                ${className}
            `}
            whileHover={{
                scale: 1.1,
                boxShadow: `0 0 30px ${glowColor}`
            }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            {children}
        </motion.div>
    )
}
