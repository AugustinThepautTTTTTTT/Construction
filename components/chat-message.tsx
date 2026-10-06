import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RoomArtifact } from "./room-artifact";
import type { Message } from "@/lib/domain";
function MessageView({ message,onOpenArtifact }: { message: Message;onOpenArtifact?:(id:string)=>void }) {
  return (
    <article className={`message ${message.role}`}>
      <span>{message.role === "user" ? "You" : "Roomwise"}</span>
      <div className="messageBody">
        {!!message.photoIds?.length && (
          <div className="roomPhotos">
            {message.photoIds.map((id) => (
              <a
                key={id}
                href={`/api/photos/${id}`}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={`/api/photos/${id}`}
                  alt="Uploaded room photo"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
        {message.role === "assistant" ? (
          <div className="formattedReply">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={{
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                img: () => null,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="userText">{message.content}</p>
        )}
        {message.artifactIds?.map((id) => (
          onOpenArtifact?<button key={id} className="projectSavedLink" onClick={()=>onOpenArtifact(id)}>View saved project item <span>↗</span></button>:<RoomArtifact key={id} id={id} />
        ))}
        {message.status === "failed" && (
          <small className="replyState">
            Reply interrupted. You can send your message again.
          </small>
        )}
      </div>
    </article>
  );
}

export const ChatMessage = memo(MessageView);
