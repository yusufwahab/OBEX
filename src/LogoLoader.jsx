import React from 'react'
import useLoadingStore from './store/loading-store'
import primusLogo from './obex-logo.png'
// import { immer } from 'zustand/middleware/immer';

export default function LogoLoader() {
    const loading = useLoadingStore((state) => state.loading);

    if (!loading) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50">
            <img src={primusLogo} alt="Loading..." className="w-40 h-20 xl:w-60 xl:h-30 animate-ping"/>
        </div>
    )
}
