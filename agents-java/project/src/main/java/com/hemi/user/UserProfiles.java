/*
 *  Copyright (c) 2017 Hemi Trickey; released under the "MIT license".
 *  See the LICENSE file packaged with this software for details.
 *
 */

package com.hemi.user;

import java.util.HashMap;
import java.util.Map;

public class UserProfiles {
    private static Map<String, UserProfile> authenticatedUsers = new HashMap<String, UserProfile>(10);
    private static Map<String, UserProfile> unauthenticatedUsers = new HashMap<String, UserProfile>(10);

    synchronized public static UserProfile recordUserVisit (String userSessionId, String userId) {
        UserProfile userProfile = null;
        if (userId == null) {   // Unauthenticated user
            if (unauthenticatedUsers.containsKey(userSessionId)) {
                userProfile = unauthenticatedUsers.get(userSessionId);
            } else {
                userProfile = new UserProfile(userSessionId);
                unauthenticatedUsers.put(userSessionId, userProfile);
            }
        } else {    // Authenticated user
            if (authenticatedUsers.containsKey(userId)) {
                userProfile = authenticatedUsers.get(userId);
            } else {
                // First check for sessionId in the unauthenticated user pool
                if (unauthenticatedUsers.containsKey(userSessionId)) {
                    userProfile = unauthenticatedUsers.get(userSessionId);
                    unauthenticatedUsers.remove(userSessionId);
                } else {
                    userProfile = new UserProfile(userSessionId, userId);
                }
                authenticatedUsers.put(userId, userProfile);
            }
        }

        userProfile.recordUserVisit(userSessionId, userId);
        return userProfile;
    }
}
