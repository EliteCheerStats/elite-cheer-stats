"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FollowTeamButtonProps = {
  teamId: string;
  initialIsFollowing: boolean;
  isLoggedIn: boolean;
  loginHref?: string;
};

export default function FollowTeamButton({
  teamId,
  initialIsFollowing,
  isLoggedIn,
  loginHref = "/login",
}: FollowTeamButtonProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!isLoggedIn) {
      router.push(loginHref);
      return;
    }

    try {
      setLoading(true);

      const endpoint = isFollowing ? "/api/unfollow-team" : "/api/follow-team";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teamId }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || "Request failed");
      }

      setIsFollowing(!isFollowing);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition border ${
        isFollowing
          ? "border-teal-400 bg-teal-500/10 text-teal-300"
          : "border-white/15 bg-white/5 text-white hover:bg-white/10"
      } disabled:opacity-50`}
    >
      {loading ? "Saving..." : isFollowing ? "Following" : "Follow Team"}
    </button>
  );
}