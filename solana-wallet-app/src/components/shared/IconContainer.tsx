import React from "react"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

interface IconContainerProps {
    icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>
    className?: string
    iconClassName?: string
    animatePulse?: boolean
}

export const IconContainer: React.FC<IconContainerProps> = ({
    icon: Icon,
    className,
    iconClassName,
    animatePulse = false
}) => {
    return (
        <div
            className={cn(
                "relative flex items-center justify-center w-14 h-14 rounded-full",
                "bg-white/5 border border-white/10 backdrop-blur-md",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                className
            )}
        >
            <motion.div
                animate={
                    animatePulse
                        ? {
                              scale: [1, 1.1, 1],
                              filter: [
                                  "drop-shadow(0 0 8px rgba(127, 255, 212, 0.4))",
                                  "drop-shadow(0 0 16px rgba(127, 255, 212, 0.6))",
                                  "drop-shadow(0 0 8px rgba(127, 255, 212, 0.4))"
                              ]
                          }
                        : {}
                }
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                <Icon
                    strokeWidth={1.5}
                    className={cn("w-7 h-7 text-[#7fffd4] icon-glow", "fill-[#7fffd4]/20", iconClassName)}
                />
            </motion.div>
        </div>
    )
}
