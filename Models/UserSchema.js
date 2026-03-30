const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
    {
        guildID: {
            type: String,
            required: true,
            index: true
        },
        userID: {
            type: String,
            required: true,
            index: true
        },
        username: String,

        // Level System
        level: {
            type: Number,
            default: 1,
            index: true
        },
        xp: {
            type: Number,
            default: 0
        },
        totalXp: {
            type: Number,
            default: 0
        },

        // Prestige System
        prestige: {
            type: Number,
            default: 0
        },

        // Rank Position
        rank: {
            type: Number,
            default: 0
        },

        // Streaks
        streak: {
            type: Number,
            default: 0
        },
        lastStreakDate: {
            type: Date,
            default: null
        },
        maxStreak: {
            type: Number,
            default: 0
        },

        // Badges/Achievements
        badges: [{
            name: String,
            description: String,
            icon: String,
            obtainedAt: Date
        }],

        // Stats detalladas
        stats: {
            messagesCount: {
                type: Number,
                default: 0
            },
            reactionsReceived: {
                type: Number,
                default: 0
            },
            levelUps: {
                type: Number,
                default: 0
            },
            prestigeCount: {
                type: Number,
                default: 0
            },
            bonusXpEarned: {
                type: Number,
                default: 0
            }
        },

        // Timestamps
        lastXpGain: {
            type: Date,
            default: Date.now
        },
        lastDailyBonus: {
            type: Date,
            default: null
        },
        createdAt: {
            type: Date,
            default: Date.now,
            index: true
        },
        updatedAt: {
            type: Date,
            default: Date.now
        },

        // User profile customization
        profile: {
            phrase: {
                type: String,
                default: ''
            },
            stats: {
                pats: {
                    type: Number,
                    default: 0
                },
                charisma: {
                    type: Number,
                    default: 0
                },
                deaths: {
                    type: Number,
                    default: 0
                }
            },
            birthday: {
                day: {
                    type: Number,
                    default: null
                },
                month: {
                    type: Number,
                    default: null
                }
            },
            birthdayConfig: {
                blockedGuilds: {
                    type: [String],
                    default: []
                },
                lastSetAt: {
                    type: Date,
                    default: null
                }
            },
            genshin: {
                uid: {
                    type: String,
                    default: null
                },
                region: {
                    type: String,
                    default: null
                },
                linkedAt: {
                    type: Date,
                    default: null
                },
                manualRoster: {
                    type: [String],
                    default: []
                },
                manualRosterUpdatedAt: {
                    type: Date,
                    default: null
                }
            }
        },

        // Marriage System
        marriage: {
            spouse: {
                type: String,
                default: null
            },
            anniversaryDate: {
                type: Date,
                default: null
            },
            marriedAt: {
                type: Date,
                default: null
            }
        },

        // Marriage Proposals
        marriageProposal: {
            from: {
                type: String,
                default: null
            },
            anniversaryDate: {
                type: Date,
                default: null
            },
            createdAt: {
                type: Date,
                default: null
            }
        },

        // Extra Relationships (amigo, hermano, crush, rival, etc.)
        relationships: {
            type: [{
                userId: { type: String },
                type: { type: String, default: 'amigo' },
                since: { type: Date, default: Date.now }
            }],
            default: []
        },

        // Social progression (Fase 1)
        socialProgress: {
            compatChecks: {
                type: Number,
                default: 0
            },
            relationshipsCreated: {
                type: Number,
                default: 0
            },
            marriagesCount: {
                type: Number,
                default: 0
            },
            anniversariesCelebrated: {
                type: Number,
                default: 0
            },
            firstRelationshipAt: {
                type: Date,
                default: null
            },
            lastRelationshipAt: {
                type: Date,
                default: null
            },
            lastCompatibilityAt: {
                type: Date,
                default: null
            },
            lastMarriageAt: {
                type: Date,
                default: null
            },
            lastAnniversaryAt: {
                type: Date,
                default: null
            }
        }
    },
    {
        timestamps: true,
        collection: 'users'
    }
);

// Index for efficient queries
UserSchema.index({ guildID: 1, userID: 1 }, { unique: true });
UserSchema.index({ guildID: 1, level: -1, prestige: -1 });
UserSchema.index({ guildID: 1, totalXp: -1 });
UserSchema.index({ guildID: 1, createdAt: -1 });
UserSchema.index({ guildID: 1, 'stats.messagesCount': -1 });

module.exports = model('User', UserSchema);
