import { raw } from 'hono/html';
import { renderToString } from 'hono/jsx/dom/server';

export default function renderDescription(body: string | null, videos: Array<{ src?: string; poster?: string }>, replies: Array<{ author?: string; text: string; likes?: number }>) {
    return renderToString(
        <>
            {videos
                .filter((video) => video.src)
                .map((video) => (
                    <video src={video.src} poster={video.poster} controls preload="none" />
                ))}
            {body ? raw(body) : null}
            {replies.length > 0 && (
                <>
                    <h2>精选回复</h2>
                    {replies.map((reply) => (
                        <blockquote>
                            <p>
                                <strong>{reply.author || '虎扑用户'}</strong>
                                {reply.likes ? ` · ${reply.likes} 亮` : ''}
                            </p>
                            <p>{reply.text}</p>
                        </blockquote>
                    ))}
                </>
            )}
        </>
    );
}
