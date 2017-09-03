/*
 *  Copyright (c) 2017 Hemi Trickey; released under the "MIT license".
 *  See the LICENSE file packaged with this software for details.
 *
 */

package com.hemi.user;

import java.text.SimpleDateFormat;
import java.util.*;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

public class UserProfile {
    private static final Log LOG = LogFactory.getLog(UserProfile.class);

    private final static int FREQUENT_VISITS_MONITORING_INTERVAL_UNIT = Calendar.MINUTE;  // Set it to MONTH for more real conditions
    private final static int FREQUENT_VISITS_MONITORING_WINDOW = 5;    // last X INTERVAL_UNITs, set it to 12 MONTHs for more real conditions
    private final static int FREQUENT_VISITOR_SCORE_THRESHOLD = 2;  // >= threshold, set it to 5 for more real conditions
    private final static SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMddHHmm");    // Must match INTERVAL_UNIT

    // At any point in time, if userId == null then there should be only 1 userSession, i.e. an unauthenticated user
    private String userId = null;
    private Set<String> userSessions = null;

    private Map<String, Boolean> recentVisitsFrequency = null; // Keep a sliding record of last N months

    private int recentVisitsFrequencyScore = 0;
    private boolean isFrequentVisitor = false;


    public UserProfile (String userSessionId, String userId) {
        this.userSessions = new HashSet<String>();
        this.userSessions.add(userSessionId);

        this.userId = userId;

        recentVisitsFrequency = new HashMap<String, Boolean>(FREQUENT_VISITS_MONITORING_WINDOW);
        recentVisitsFrequency.put(dateFormat.format(new Date()), Boolean.TRUE);
        recentVisitsFrequencyScore = 1;
        isFrequentVisitor = false;
    }

    public UserProfile (String userSessionId) {
        this(userSessionId, null);
    }

    public void recordUserVisit(String userSessionId) {
        recordUserVisit(userSessionId, null);
    }

    synchronized public void recordUserVisit(String userSessionId, String userId) {
        if (userId != null && this.userId == null) {
            this.userId = userId;
        }
        if (this.userId != null) {  // Authenticated user
            if (!this.userSessions.contains(userSessionId)) {
                this.userSessions.add(userSessionId);
            }
        }

        LOG.info("recordUserVisit: " + userSessionId + ", " + userId + "; frequencyScore: " + recentVisitsFrequencyScore);

        // First trim the monitoring window if necessary
        String currentInterval = dateFormat.format(new Date());
        Calendar newStartInterval = Calendar.getInstance();

        newStartInterval.add(FREQUENT_VISITS_MONITORING_INTERVAL_UNIT, -FREQUENT_VISITS_MONITORING_WINDOW);
        String newStartIntervalKey = dateFormat.format(newStartInterval.getTime());

        LOG.info("Checking recentVisitsFrequency...");
        Set<String> intervals = recentVisitsFrequency.keySet();
        String interval = null;
        for (Iterator i = intervals.iterator(); i.hasNext(); ) {
            interval = (String) i.next();
            LOG.info(interval);
            if (interval.compareTo(newStartIntervalKey) < 0) {
                LOG.info(interval + " is outside the monitoring window " + newStartIntervalKey);
                if (recentVisitsFrequency.get(interval).equals(Boolean.TRUE)) {
                    recentVisitsFrequencyScore--;
                }
                recentVisitsFrequency.remove(interval);
                LOG.info("Removing " + interval + " AND updating frequency score to: " + recentVisitsFrequencyScore);
            }
        }

        // Record this visit
        if (!recentVisitsFrequency.containsKey(currentInterval) || !recentVisitsFrequency.get(currentInterval).equals(Boolean.TRUE)) {
            recentVisitsFrequency.put(currentInterval, Boolean.TRUE);
            recentVisitsFrequencyScore++;
            LOG.info("Updating current visit interval.  Updated frequency score: " + recentVisitsFrequencyScore);
        }

        if (recentVisitsFrequencyScore >= FREQUENT_VISITOR_SCORE_THRESHOLD) {
            isFrequentVisitor = true;
            LOG.warn(userSessionId + ", " + userId + " is a frequent visitor!");
        } else {
            isFrequentVisitor = false;
        }
    }

    public String getUserId() { return this.userId; }
    public boolean isFrequentVisitor() { return this.isFrequentVisitor; }
}
