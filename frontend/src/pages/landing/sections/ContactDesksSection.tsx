import React from 'react';
import { LANDING_DATA } from '../landingData';
import { Calendar, MessageSquare, Briefcase, ArrowRight, Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ContactDesksSection() {
  const { contact } = LANDING_DATA;

  return (
    <section id="contact" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-[#E8DFC8]/60 bg-[#F5EFE6]/50">
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#B76E79]">
            {contact.kicker}
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-medium text-[#1A120C] mt-2.5">
            {contact.title}
          </h2>
          <p className="text-sm sm:text-base text-[#6F5F53] mt-3 font-normal leading-relaxed">
            {contact.subtitle}
          </p>
        </div>

        {/* 3 Interactive Desks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {contact.cards.map((card, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-white/85 backdrop-blur-md border border-[#E8DFC8] shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#1C1510] text-[#E8C7A8] flex items-center justify-center shadow-sm">
                  {card.icon === 'calendar' && <Calendar className="w-5 h-5" />}
                  {card.icon === 'message' && <MessageSquare className="w-5 h-5" />}
                  {card.icon === 'briefcase' && <Briefcase className="w-5 h-5" />}
                </div>

                <h3 className="font-serif text-xl font-bold text-[#1C1510]">
                  {card.title}
                </h3>

                <p className="text-xs sm:text-sm text-[#5F4E44] leading-relaxed">
                  {card.info}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-[#E8DFC8]/60">
                <Link
                  to={card.href}
                  className="w-full py-3 rounded-full bg-[#FAF7F2] hover:bg-[#1C1510] text-[#1C1510] hover:text-[#FAF7F2] border border-[#D5C6B5] hover:border-[#1C1510] text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 group"
                >
                  <span>{card.actionLabel}</span>
                  <ArrowRight className="w-4 h-4 text-[#B76E79] group-hover:text-[#E8C7A8] transition-colors" />
                </Link>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
