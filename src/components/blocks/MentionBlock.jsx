import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPageById } from '../../lib/pages.js';
import { getBlocks } from '../../lib/blocks.js';

export default function MentionBlock({ block, onUpdate, onDelete, onAddBlock, onNavigate }) {
  const [resolvedPage, setResolvedPage] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [embeddedBlocks, setEmbeddedBlocks] = useState([]);
  const [loadingEmbed, setLoadingEmbed] = useState(false);

  const pageId = block.content || '';
  const cachedProps = typeof block.props === 'string'
    ? JSON.parse(block.props || '{}')
    : (block.props || {});

  // Resolve the referenced page on mount and when pageId changes
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!pageId) {
        setIsDeleted(true);
        setLoading(false);
        return;
      }

      try {
        const page = await getPageById(pageId);

        if (cancelled) return;

        if (!page) {
          setIsDeleted(true);
          setResolvedPage(null);
        } else {
          setResolvedPage(page);
          setIsDeleted(false);

          // Update cached props if title or icon changed
          if (page.title !== cachedProps.page_title || page.icon !== cachedProps.page_icon) {
            onUpdate(block.id, {
              props: {
                ...cachedProps,
                page_title: page.title,
                page_icon: page.icon,
              },
            });
          }
        }
      } catch (err) {
        console.error('MentionBlock: failed to resolve page', err);
        if (!cancelled) {
          setIsDeleted(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [pageId]);

  // Load embedded blocks when expanded
  useEffect(() => {
    let cancelled = false;

    async function loadEmbed() {
      if (!expanded || isDeleted || !pageId) {
        setEmbeddedBlocks([]);
        return;
      }

      setLoadingEmbed(true);
      try {
        const blocks = await getBlocks(pageId);
        if (!cancelled) {
          setEmbeddedBlocks(blocks);
        }
      } catch (err) {
        console.error('MentionBlock: failed to load embedded blocks', err);
        if (!cancelled) {
          setEmbeddedBlocks([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingEmbed(false);
        }
      }
    }

    loadEmbed();
    return () => { cancelled = true; };
  }, [expanded, isDeleted, pageId]);

  const handleChipClick = useCallback(() => {
    if (!isDeleted && pageId && onNavigate) {
      onNavigate(pageId);
    }
  }, [isDeleted, pageId, onNavigate]);

  const handleToggleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onDelete(block.id);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAddBlock(block.position, 'text');
    }
  }, [block.id, block.position, onDelete, onAddBlock]);

  // Determine display values: use resolved page data, fall back to cached props
  const displayIcon = resolvedPage?.icon || cachedProps.page_icon || '\u{1F4C4}';
  const displayTitle = resolvedPage?.title || cachedProps.page_title || 'Untitled';

  if (loading) {
    return (
      <div className="block-mention">
        <div className="mention-loading">Loading...</div>
      </div>
    );
  }

  if (isDeleted) {
    return (
      <div className="block-mention" tabIndex={0} onKeyDown={handleKeyDown}>
        <div className="mention-chip deleted">
          <span className="mention-icon">{'\u26A0\uFE0F'}</span>
          <span className="mention-title">Deleted page</span>
        </div>
      </div>
    );
  }

  return (
    <div className="block-mention" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="mention-chip" onClick={handleChipClick}>
        <span className="mention-icon">{displayIcon}</span>
        <span className="mention-title">{displayTitle}</span>
        <button
          className="mention-arrow"
          onClick={handleToggleExpand}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '\u25BE' : '\u25B8'}
        </button>
      </div>

      {expanded && (
        <div className="mention-embed">
          {loadingEmbed && (
            <div className="mention-loading">Loading blocks...</div>
          )}
          {!loadingEmbed && embeddedBlocks.length === 0 && (
            <div className="embed-block" style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Empty page
            </div>
          )}
          {!loadingEmbed && embeddedBlocks.map((embBlock) => (
            <div key={embBlock.id} className="embed-block">
              {renderReadOnlyBlock(embBlock)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a block as read-only text for the embedded preview.
 * Keeps it simple: no contentEditable, no interactions.
 */
function renderReadOnlyBlock(block) {
  const content = block.content || '';
  const props = typeof block.props === 'string'
    ? JSON.parse(block.props || '{}')
    : (block.props || {});

  switch (block.type) {
    case 'h1':
      return <div style={{ fontSize: '24px', fontWeight: 700 }}>{content}</div>;
    case 'h2':
      return <div style={{ fontSize: '20px', fontWeight: 600 }}>{content}</div>;
    case 'h3':
      return <div style={{ fontSize: '18px', fontWeight: 600 }}>{content}</div>;
    case 'bullet':
      return <div>{'\u2022'} {content}</div>;
    case 'number':
      return <div>{content}</div>;
    case 'todo': {
      const checked = block.checked;
      return (
        <div>
          <span>{checked ? '\u2611' : '\u2610'}</span>{' '}
          <span style={checked ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>
            {content}
          </span>
        </div>
      );
    }
    case 'quote':
      return (
        <div style={{ borderLeft: '3px solid var(--border-heavy)', paddingLeft: '10px', fontStyle: 'italic' }}>
          {content}
        </div>
      );
    case 'callout':
      return <div>{'\u{1F4A1}'} {content}</div>;
    case 'code':
      return (
        <pre style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          background: 'var(--code-bg)',
          padding: '4px 8px',
          borderRadius: '3px',
          whiteSpace: 'pre-wrap',
        }}>
          {content}
        </pre>
      );
    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />;
    case 'table': {
      try {
        const data = JSON.parse(content);
        const headers = data.headers || [];
        const rows = data.rows || [];
        return (
          <table style={{ borderCollapse: 'collapse', fontSize: '13px', width: '100%' }}>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} style={{ border: '1px solid var(--border-default)', padding: '4px 6px', fontWeight: 600, background: 'var(--bg-hover)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci} style={{ border: '1px solid var(--border-default)', padding: '4px 6px' }}>
                      {row[ci] || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      } catch {
        return <div>{content}</div>;
      }
    }
    case 'image': {
      const caption = props.caption || '';
      return (
        <div style={{ textAlign: 'center' }}>
          {content ? (
            <img src={content} alt={caption} style={{ maxWidth: '100%', borderRadius: '4px' }} />
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>[image]</span>
          )}
          {caption && <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{caption}</div>}
        </div>
      );
    }
    case 'mention': {
      const title = props.page_title || 'Untitled';
      const icon = props.page_icon || '\u{1F4C4}';
      return <div>{icon} {title}</div>;
    }
    case 'text':
    default:
      return <div>{content}</div>;
  }
}
