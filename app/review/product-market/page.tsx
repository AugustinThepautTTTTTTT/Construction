import {notFound} from 'next/navigation';
import {MarketReview} from './review';
import '@/components/project-workspace.css';
import '@/components/chat-artifact.css';
import '@/components/product-market.css';
export const dynamic='force-dynamic';
export default function Review(){if(process.env.VERCEL_ENV!=='preview')notFound();return <MarketReview/>;}
