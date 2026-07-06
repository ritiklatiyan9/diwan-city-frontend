import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import api from "../../api/api";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, LogOut, User } from "lucide-react";

export function ActivityCard() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [terminatingSessionId, setTerminatingSessionId] = useState(null);

    const fetchActivities = async (currentPage) => {
        try {
            setLoading(true);
            const { data } = await api.get(`/activity/today?page=${currentPage}&limit=5`);
            setActivities(data.activities);
            setTotalPages(data.pagination.totalPages || 1);
        } catch (error) {
            console.error("Failed to fetch activity", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities(page);
    }, [page]);

    const handlePrev = () => setPage((p) => Math.max(1, p - 1));
    const handleNext = () => setPage((p) => Math.min(totalPages, p + 1));

    const handleForceLogout = async (targetSessionId) => {
        if (!targetSessionId) return;
        const confirmed = window.confirm("Force logout this session?");
        if (!confirmed) return;

        try {
            setTerminatingSessionId(targetSessionId);
            await api.post("/activity/logout-session", { sessionId: targetSessionId });
            toast.success("Session logged out");

            const mySessionId = parseInt(localStorage.getItem("sessionId"), 10);
            if (mySessionId === targetSessionId) {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                localStorage.removeItem("sessionId");
                window.location.href = "/login";
                return;
            }

            await fetchActivities(page);
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to logout session");
        } finally {
            setTerminatingSessionId(null);
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return "--:--";
        return new Date(isoString).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    };

    return (
        <div className="group relative w-full h-full p-5 rounded-2xl bg-slate-900/2 border border-slate-900/6 backdrop-blur-sm transition-all duration-500 hover:bg-slate-900/4 hover:border-slate-900/10 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                        Recent Login Activities
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handlePrev}
                        disabled={page === 1}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-medium text-slate-500 min-w-10 text-center">
                        {page} / {totalPages}
                    </span>
                    <button
                        onClick={handleNext}
                        disabled={page === totalPages}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Activity List */}
            <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                    </div>
                ) : activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <p className="text-sm font-medium">No activity yet</p>
                        <p className="text-xs">Sessions will appear here</p>
                    </div>
                ) : (
                    activities.map((act) => {
                        const isActive = !act.logout_time;
                        const mySessionId = parseInt(localStorage.getItem("sessionId"), 10);
                        const isCurrentSession = mySessionId === act.session_id;
                        const isBusy = terminatingSessionId === act.session_id;

                        return (
                            <div
                                key={act.session_id}
                                className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-white/60"
                            >
                                {/* Avatar */}
                                <div className="relative">
                                    {act.photo ? (
                                        <img
                                            src={act.photo}
                                            alt={act.name}
                                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-500">
                                            <User className="w-4 h-4" />
                                        </div>
                                    )}
                                    {isActive && (
                                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                        {act.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                                        {act.role?.replace("_", " ")}
                                    </p>
                                </div>

                                {/* Timing */}
                                <div className="text-right flex flex-col items-end">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium text-slate-700 font-mono">
                                            {formatTime(act.login_time)}
                                        </span>
                                        <span className="text-[10px] text-slate-400">→</span>
                                        <span
                                            className={cn(
                                                "text-xs font-mono font-medium",
                                                isActive ? "text-emerald-600" : "text-slate-700"
                                            )}
                                        >
                                            {isActive ? "Active" : formatTime(act.logout_time)}
                                        </span>
                                    </div>
                                    {isActive && (
                                        <button
                                            onClick={() => handleForceLogout(act.session_id)}
                                            disabled={isBusy}
                                            className="mt-1 inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                            title={isCurrentSession ? "Logout this current session" : "Force logout this session"}
                                        >
                                            {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                                            {isCurrentSession ? "Logout Me" : "Logout"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 rounded-2xl bg-linear-to-b from-slate-900/1 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </div>
    );
}
