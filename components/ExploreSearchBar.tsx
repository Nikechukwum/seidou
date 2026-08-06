'use client';

import React, { useState, useRef, useEffect } from 'react';
import { InstantSearch, useSearchBox, useHits } from 'react-instantsearch';
import { algoliasearch } from 'algoliasearch';
import Image from 'next/image';
import { Search, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Added comment: Initialize the search client with public keys
const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY!
);

export default function ExploreSearchBar() {
  return (
    <InstantSearch searchClient={searchClient} indexName="seidou_products">
      <CustomSearchContent />
    </InstantSearch>
  );
}

function CustomSearchContent() {
  const { query, refine } = useSearchBox();
  const { items } = useHits();
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refineRef = useRef(refine);
  useEffect(() => {
    refineRef.current = refine;
  }, [refine]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    if (inputValue.length > 0) {
      setIsSearching(true);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      refineRef.current(inputValue);
      setIsSearching(false);
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue]);

  const handleBlur = (e: React.FocusEvent) => {
    // Only close if focus moved outside the container
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsOpen(value.length > 0);
  };

  return (
    <div 
      className="w-full h-fit px-4 mb-6 relative"
      ref={containerRef}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      {/* Search Input Container */}
      <div className={`relative flex items-center w-full bg-white rounded-full px-4 py-3 border-2 border-gray-100 shadow-black/10 shadow-2xl transition-all`}>
        <Search className="w-5 h-5 text-gray-400 mr-3" />
        <input
          className="bg-transparent outline-none w-full text-gray-600 text-sm placeholder-gray-400"
          placeholder="Search for clothes, accessories..."
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.length > 0 && setIsOpen(true)}
        />
      </div>

      {/* Dropdown Results Overlay */}
      {isOpen && (
        <div 
          className="absolute top-full left-4 right-4 mt-2 bg-white rounded-3xl shadow-2xl shadow-black/10 border-2 border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            {isSearching ? (
              // Skeleton Loader
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl">
                  <div className="flex items-center space-x-4">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ))
            ) : items.length > 0 ? (
              items.slice(0, 3).map((hit: any) => (
                <div 
                  onClick={()=>{refine(''); setInputValue(''); router.push(`?id=${hit.objectID}`, { scroll: false }); setIsOpen(false);}}
                  key={hit.objectID} 
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl cursor-pointer group transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      <Image
                        src={hit.image || '/placeholder.png'}
                        alt={hit.title}
                        fill
                        sizes="(max-width: 768px) 100px, 100px"
                        className="object-cover"
                        quality={65}
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800 text-sm">{hit.title}</h4>
                      <p className="text-xs text-gray-400 capitalize">
                        {hit.vendor}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm">No results found for "{inputValue}"</div>
            )}

            {/* Bottom Global Search Action */}
            {query.length > 0 && <div className="border-t border-gray-50 mt-1 pt-1">
              <div onClick={() => { refine(''); setIsOpen(false); }} className="flex items-center p-3 hover:bg-gray-50 rounded-2xl cursor-pointer text-gray-700 group transition-colors">
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mr-4">
                  <Search className="w-5 h-5 text-[#737e8d]" />
                </div>
                <span className="font-medium text-sm">Search for "{inputValue}"</span>
              </div>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}