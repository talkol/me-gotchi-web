"use client";

import { Button } from "@/components/ui/button";
import { Heart, Sparkles, Camera, Lightbulb, Gift, Monitor, Facebook, Twitter, Instagram, DownloadCloud } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-yellow-400 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Me-gotchi Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold text-purple-900">Me-gotchi</span>
          </div>
          
          {/* CTA Button */}
          <Button asChild className="text-1xl bg-teal-400 hover:bg-teal-500 text-purple-900 font-bold rounded-full px-6 py-2">
            <Link href="/invite">Try it now</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-teal-400 py-0 px-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between">
          <div className="lg:w-1/2 mb-10 lg:mb-0">
            <h1 className="text-5xl lg:text-7xl font-bold text-purple-900 mb-8">
              Create your own Tamagotchi
            </h1>
            <p className="text-2xl text-purple-900 mb-8">
              Turn yourself, friends or family into a unique virtual pet that you can grow and love.
            </p>
            <Button asChild className="bg-yellow-400 hover:bg-yellow-500 text-purple-900 font-bold text-lg px-8 py-4 rounded-full">
              <Link href="/invite">Generate Yours Now</Link>
            </Button>
          </div>
          
          {/* Hero Logo */}
          <div className="lg:w-1/2 flex justify-center">
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="Me-gotchi Logo" 
                className="w-96 h-[28rem] object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl font-medium text-purple-900 text-center mb-16">
            How It Works
          </h2>
          
          {/* Three Step Process */}
          <div className="grid md:grid-cols-3 gap-12">
            <div className="bg-pink-100 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <p className="text-purple-900 text-2xl font-normal">Upload a photo</p>
            </div>
            
            <div className="bg-pink-100 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <p className="text-purple-900 text-2xl font-normal">AI generates your unique Me-gotchi</p>
            </div>
            
            <div className="bg-pink-100 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <DownloadCloud className="w-8 h-8 text-white" />
              </div>
              <p className="text-purple-900 text-2xl font-normal">Download to phone</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-8">
              <img 
                src="/example1.png" 
                alt="Me-gotchi Example 1" 
                className="object-contain"
              />
              <img 
                src="/example1.png" 
                alt="Me-gotchi Example 2" 
                className="object-contain"
              />
              <img 
                src="/example1.png" 
                alt="Me-gotchi Example 3" 
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-purple-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex space-x-8 mb-6 md:mb-0">
            <Link href="/invite" className="text-white hover:text-gray-300">Use Invite Code</Link>
            <Link href="/admin" className="text-white hover:text-gray-300">Admin</Link>
          </div>
          
          <div className="flex space-x-6">
            <Link href="#" className="text-white hover:text-gray-300">
              <Facebook className="w-6 h-6" />
            </Link>
            <Link href="#" className="text-white hover:text-gray-300">
              <Twitter className="w-6 h-6" />
            </Link>
            <Link href="#" className="text-white hover:text-gray-300">
              <Instagram className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
