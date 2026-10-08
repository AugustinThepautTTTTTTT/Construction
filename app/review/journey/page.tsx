import {notFound} from 'next/navigation';
import JourneyReview from './review';
import '@/app/chat/chat.css';
import '@/components/project-workspace.css';
import '@/components/chat-artifact.css';
import '@/components/inspiration-library.css';
export const dynamic='force-dynamic';
export default function Page(){if(process.env.VERCEL_ENV!=='preview')notFound();return <JourneyReview/>;}
