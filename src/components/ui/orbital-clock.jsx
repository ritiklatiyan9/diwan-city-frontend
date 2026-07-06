import { useState, useEffect, useRef } from "react"

export function OrbitalClock() {
    const [time, setTime] = useState(new Date())
    const [isHovered, setIsHovered] = useState(false)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const containerRef = useRef(null)

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date())
        }, 50)
        return () => clearInterval(interval)
    }, [])

    const handleMouseMove = (e) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
        const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
        setMousePos({ x: x * 8, y: y * 8 })
    }

    const seconds = time.getSeconds() + time.getMilliseconds() / 1000
    const minutes = time.getMinutes() + seconds / 60
    const hours = (time.getHours() % 12) + minutes / 60

    const secondDeg = seconds * 6
    const minuteDeg = minutes * 6
    const hourDeg = hours * 30

    const formatTime = () => {
        return time.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        }).toUpperCase()
    }

    const formatDate = () => {
        return time.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        })
    }

    return (
        <div
            ref={containerRef}
            className="relative flex flex-col items-center justify-center cursor-pointer select-none text-slate-900"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false)
                setMousePos({ x: 0, y: 0 })
            }}
            onMouseMove={handleMouseMove}
            style={{ perspective: "600px" }}
        >
            {/* Main clock container */}
            <div
                className="relative w-44 h-44 transition-transform duration-300 ease-out"
                style={{
                    transform: `rotateX(${-mousePos.y}deg) rotateY(${mousePos.x}deg)`,
                }}
            >
                {/* Outer glow ring */}
                <div
                    className="absolute inset-0 rounded-full transition-all duration-500"
                    style={{
                        background: isHovered
                            ? "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)"
                            : "transparent",
                        transform: isHovered ? "scale(1.3)" : "scale(1)",
                    }}
                />

                {/* Clock face */}
                <div className="absolute inset-2 rounded-full bg-white/95 border border-slate-200/70 shadow-xl">
                    {/* Inner subtle ring */}
                    <div
                        className={`absolute inset-3 rounded-full border transition-all duration-500 ${isHovered ? "border-blue-400/40" : "border-black/5"
                            }`}
                    />

                    {/* Hour markers */}
                    {Array.from({ length: 12 }).map((_, i) => {
                        const angle = i * 30
                        const isActive = Math.floor(hours) === i || Math.floor(hours) === i + 12
                        const rad = (angle - 90) * (Math.PI / 180)
                        const x = 50 + 38 * Math.cos(rad)
                        const y = 50 + 38 * Math.sin(rad)

                        return (
                            <div
                                key={i}
                                className="absolute w-1.5 h-1.5 rounded-full transition-all duration-300"
                                style={{
                                    left: `${x}%`,
                                    top: `${y}%`,
                                    transform: "translate(-50%, -50%)",
                                    background: isActive
                                        ? "rgb(59,130,246)"
                                        : i % 3 === 0
                                            ? "rgba(15,23,42,0.7)"
                                            : "rgba(15,23,42,0.35)",
                                    boxShadow: isActive
                                        ? "0 0 10px rgba(59,130,246,0.7)"
                                        : "none",
                                }}
                            />
                        )
                    })}

                    {/* Hour hand */}
                    <div
                        className="absolute left-1/2 bottom-1/2 w-1 origin-bottom rounded-full bg-slate-800"
                        style={{
                            height: "28%",
                            transform: `translateX(-50%) rotate(${hourDeg}deg)`,
                        }}
                    />

                    {/* Minute hand */}
                    <div
                        className="absolute left-1/2 bottom-1/2 w-0.5 origin-bottom rounded-full bg-slate-500"
                        style={{
                            height: "36%",
                            transform: `translateX(-50%) rotate(${minuteDeg}deg)`,
                        }}
                    />

                    {/* Second hand */}
                    <div
                        className="absolute left-1/2 bottom-1/2 origin-bottom rounded-full"
                        style={{
                            width: "1px",
                            height: "40%",
                            transform: `translateX(-50%) rotate(${secondDeg}deg)`,
                            background: "rgb(59,130,246)",
                            boxShadow: "0 0 8px rgba(59,130,246,0.7)",
                        }}
                    />

                    {/* Center dot */}
                    <div
                        className="absolute left-1/2 top-1/2 w-2.5 h-2.5 rounded-full transition-all duration-300"
                        style={{
                            transform: "translate(-50%, -50%)",
                            background: isHovered ? "rgb(59,130,246)" : "rgba(15,23,42,0.9)",
                            boxShadow: isHovered
                                ? "0 0 12px rgba(59,130,246,0.8)"
                                : "none",
                        }}
                    />
                </div>
            </div>

            {/* Time + Date below the clock */}
            <div className="mt-3 text-center">
                <p className="text-lg font-bold text-slate-900 font-mono tracking-wide">{formatTime()}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono tracking-[0.2em] uppercase">{formatDate()}</p>
            </div>
        </div>
    )
}
