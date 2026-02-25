-- ============================================
-- CREATUNO: VILLAGE SQUARE REACTIONS + COMMENT LIKES
-- ============================================

-- Post reactions: one reaction per user per post
CREATE TABLE IF NOT EXISTS post_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'smile', 'angry', 'excited')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_reaction_type ON post_reactions(reaction_type);

-- Comment likes: one like per user per comment
CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

-- updated_at trigger for post_reactions
DROP TRIGGER IF EXISTS update_post_reactions_updated_at ON post_reactions;
CREATE TRIGGER update_post_reactions_updated_at
BEFORE UPDATE ON post_reactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable and configure RLS to match current project style
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post reactions are viewable by everyone" ON post_reactions;
CREATE POLICY "Post reactions are viewable by everyone"
ON post_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert post reactions" ON post_reactions;
CREATE POLICY "Users can insert post reactions"
ON post_reactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own post reactions" ON post_reactions;
CREATE POLICY "Users can update own post reactions"
ON post_reactions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete own post reactions" ON post_reactions;
CREATE POLICY "Users can delete own post reactions"
ON post_reactions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Comment likes are viewable by everyone" ON comment_likes;
CREATE POLICY "Comment likes are viewable by everyone"
ON comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert comment likes" ON comment_likes;
CREATE POLICY "Users can insert comment likes"
ON comment_likes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own comment likes" ON comment_likes;
CREATE POLICY "Users can delete own comment likes"
ON comment_likes FOR DELETE USING (true);
