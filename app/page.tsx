import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center max-w-2xl px-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 bg-indigo-600 rounded-xl">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Realtime Chat
          </h1>
        </div>
        
        <p className="text-xl text-gray-600 mb-10">
          Connect with friends in real-time. Fast, secure, and beautiful messaging experience.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                Sign In to Start Chatting
              </button>
            </SignInButton>
          </SignedOut>
          
          <SignedIn>
            <Link
              href="/chat"
              className="px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Open Chat
            </Link>
            <div className="mt-4 sm:mt-0">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-2xl shadow-md">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-semibold text-gray-800 mb-1">Real-time</h3>
            <p className="text-sm text-gray-500">Instant message delivery</p>
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-md">
            <div className="text-3xl mb-2">🔒</div>
            <h3 className="font-semibold text-gray-800 mb-1">Secure</h3>
            <p className="text-sm text-gray-500">End-to-end encryption</p>
          </div>
          <div className="p-6 bg-white rounded-2xl shadow-md">
            <div className="text-3xl mb-2">💬</div>
            <h3 className="font-semibold text-gray-800 mb-1">Simple</h3>
            <p className="text-sm text-gray-500">Easy to use interface</p>
          </div>
        </div>
      </div>
    </div>
  );
}
