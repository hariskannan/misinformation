import { Info } from 'lucide-react';
import CreatePost from '../../components/CreatePost';
import PageWrapper from '../../components/PageWrapper';

export default function CreatePostPage() {
  return (
    <PageWrapper>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-navy-950 dark:text-white">
          Create a post
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your content is analyzed by the active ML model before it becomes
          visible. You will always see the result.
        </p>

        <div className="mt-6 space-y-5">
          <CreatePost />
          <div className="card flex gap-3 p-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" />
            <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-navy-950 dark:text-white">
                What happens when you press Publish?
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-slate-500 dark:text-slate-400">
                <li>The post is saved in a non-public holding state.</li>
                <li>The active model analyzes the text and records a prediction.</li>
                <li>Low risk publishes immediately; medium publishes with a warning; high risk is held for moderation.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
