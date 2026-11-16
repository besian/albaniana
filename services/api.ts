import { Article, User, UserRole, Section } from '../types';
import { MOCK_USERS, MOCK_ARTICLES } from '../constants';
import { auth, db, googleProvider } from './firebase';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    signOut, 
    updateProfile,
    onAuthStateChanged
} from "firebase/auth";
import { 
    collection, 
    getDocs, 
    getDoc, 
    setDoc, 
    doc, 
    deleteDoc,
    query,
    orderBy,
    where 
} from "firebase/firestore";

const normalizeSection = (val?: string): Section | undefined => {
    if (!val) return undefined;
    const match = Object.values(Section).find(s => s.toLowerCase() === val.toLowerCase());
    return match as Section;
}

const normalizeRole = (val?: string): UserRole => {
    if (!val) return UserRole.PUBLIC;
    const upper = val.toUpperCase();
    if (upper === 'ADMIN') return UserRole.ADMIN;
    if (upper === 'EDITOR') return UserRole.EDITOR;
    if (upper === 'AUTHOR') return UserRole.AUTHOR;
    if (upper === 'REVIEWER') return UserRole.REVIEWER;
    return UserRole.PUBLIC;
}

const mapFirebaseUser = (fbUser: any, roleStr: string = 'PUBLIC', assignedSection?: string, nameOverride?: string, bio?: string): User => {
    const finalName = nameOverride || fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
    return {
        id: fbUser.uid,
        name: finalName,
        role: normalizeRole(roleStr), 
        bio: bio || '',
        assignedSection: normalizeSection(assignedSection),
        avatar: fbUser.photoURL || `https://ui-avatars.com/api/?name=${finalName}&background=random`
    };
};

const fetchUserProfile = async (uid: string) => {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            return userDocSnap.data();
        }
    } catch (error: any) {
        if (error.code !== 'permission-denied' && error.code !== 'firestore/permission-denied') {
            console.error("Error fetching user profile:", error);
        }
    }
    return null;
};

// Helper to remove undefined properties recursively before Firestore save
const sanitizeData = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => sanitizeData(v));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([_, v]) => v !== undefined)
                .map(([k, v]) => [k, sanitizeData(v)])
        );
    }
    return obj;
};

export const api = {
  articles: {
    list: async (currentUser?: User | null): Promise<Article[]> => {
      try {
          const queries = [];
          queries.push(getDocs(query(collection(db, "articles"), where("status", "==", "PUBLISHED"))));

          if (currentUser) {
              if (currentUser.role === UserRole.ADMIN) {
                  queries.push(getDocs(query(collection(db, "articles"))));
              } 
              else if (currentUser.role === UserRole.AUTHOR || currentUser.role === UserRole.EDITOR) {
                  queries.push(getDocs(query(collection(db, "articles"), where("authorId", "==", currentUser.id))));
                  if (currentUser.role === UserRole.EDITOR && currentUser.assignedSection) {
                      queries.push(getDocs(query(collection(db, "articles"), where("section", "==", currentUser.assignedSection))));
                  }
              }
          }

          const results = await Promise.allSettled(queries);
          const articlesMap = new Map<string, Article>();

          results.forEach(result => {
              if (result.status === 'fulfilled') {
                  result.value.forEach(docSnap => {
                      const data = docSnap.data() as Article;
                      articlesMap.set(docSnap.id, { ...data, id: docSnap.id });
                  });
              }
          });

          return Array.from(articlesMap.values()).sort((a, b) => new Date(b.publishDate || 0).getTime() - new Date(a.publishDate || 0).getTime());
      } catch (e) {
          console.error("Critical error fetching articles:", e);
          return [];
      }
    },
    
    get: async (id: string): Promise<Article | undefined> => {
      const docRef = doc(db, "articles", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
          const data = docSnap.data() as Article;
          return { ...data, id: docSnap.id };
      }
      return undefined;
    },

    save: async (article: Article): Promise<Article> => {
      if (!article.id) article.id = Date.now().toString();
      
      // Sanitization prevents "undefined field" crashes in Firestore
      const cleanArticle = sanitizeData({
          ...article,
          updatedAt: new Date().toISOString()
      });

      await setDoc(doc(db, "articles", article.id), cleanArticle, { merge: true });
      return article;
    },

    delete: async (id: string): Promise<void> => {
      if (!auth.currentUser) throw new Error("Unauthenticated");
      await deleteDoc(doc(db, "articles", id));
    }
  },

  users: {
      get: async (id: string): Promise<User | null> => {
          const mock = MOCK_USERS.find(u => u.id === id);
          if (mock) return mock;
          try {
              const data = await fetchUserProfile(id);
              if (data) {
                   return {
                      id: id,
                      name: data.name || 'Unknown',
                      role: normalizeRole(data.role),
                      bio: data.bio || '',
                      assignedSection: normalizeSection(data.assignedSection),
                      avatar: data.photoURL || `https://ui-avatars.com/api/?name=${data.name}&background=random`
                  };
              }
          } catch (e) {}
          return null;
      },

      search: async (queryStr: string): Promise<User[]> => {
          const dbUsers: User[] = [];
          try {
              const usersRef = collection(db, "users");
              const qAdmin = query(usersRef, where("role", "in", [UserRole.ADMIN, UserRole.EDITOR, UserRole.AUTHOR]));
              const querySnapshot = await getDocs(qAdmin);
              querySnapshot.forEach((doc) => {
                  const data = doc.data();
                  dbUsers.push({
                      id: doc.id,
                      name: data.name || 'Unknown',
                      role: normalizeRole(data.role),
                      bio: data.bio,
                      assignedSection: normalizeSection(data.assignedSection),
                      avatar: data.photoURL || `https://ui-avatars.com/api/?name=${data.name}&background=random`
                  });
              });
          } catch (e) {}
          const combinedUsers = [...dbUsers, ...MOCK_USERS];
          const uniqueUsers = Array.from(new Map(combinedUsers.map(u => [u.id, u])).values());
          return uniqueUsers.filter(u => 
              u.name.toLowerCase().includes(queryStr.toLowerCase()) || 
              (u.assignedSection && u.assignedSection.toLowerCase().includes(queryStr.toLowerCase()))
          );
      }
  },

  auth: {
    observeAuth: (callback: (user: User | null) => void) => {
        return onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                const userProfile = await fetchUserProfile(fbUser.uid);
                callback(mapFirebaseUser(fbUser, userProfile?.role, userProfile?.assignedSection, userProfile?.name, userProfile?.bio));
            } else {
                callback(null);
            }
        });
    },

    login: async (email: string, password: string): Promise<User> => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const fbUser = userCredential.user;
        const userProfile = await fetchUserProfile(fbUser.uid);
        return mapFirebaseUser(fbUser, userProfile?.role, userProfile?.assignedSection, userProfile?.name, userProfile?.bio);
    },

    register: async (name: string, email: string, password: string): Promise<User> => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = userCredential.user;
        await updateProfile(fbUser, { displayName: name });
        try {
            await setDoc(doc(db, "users", fbUser.uid), {
                name: name,
                email: email,
                role: 'PUBLIC',
                createdAt: new Date().toISOString()
            });
        } catch (e) {}
        return mapFirebaseUser(fbUser, 'PUBLIC', undefined, name);
    },

    loginWithGoogle: async (): Promise<User> => {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        const userProfile = await fetchUserProfile(fbUser.uid);
        if (!userProfile) {
            try {
                await setDoc(doc(db, "users", fbUser.uid), {
                    name: fbUser.displayName,
                    email: fbUser.email,
                    role: 'PUBLIC',
                    createdAt: new Date().toISOString()
                });
            } catch (e) {}
        }
        return mapFirebaseUser(fbUser, userProfile?.role || 'PUBLIC', userProfile?.assignedSection, userProfile?.name || fbUser.displayName, userProfile?.bio);
    },

    updateProfile: async (user: User): Promise<User> => {
        if (auth.currentUser) {
            await updateProfile(auth.currentUser, {
                displayName: user.name,
                photoURL: user.avatar
            });
            await setDoc(doc(db, "users", auth.currentUser.uid), {
                name: user.name,
                bio: user.bio
            }, { merge: true });
            return user;
        }
        throw new Error("No authenticated user");
    },

    logout: async (): Promise<void> => {
        await signOut(auth);
    }
  }
};
