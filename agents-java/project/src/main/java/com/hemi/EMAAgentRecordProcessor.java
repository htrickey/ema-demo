/*
 *  Copyright (c) 2017 Hemi Trickey; released under the "MIT license".
 *  See the LICENSE file packaged with this software for details.
 *
 */

package com.hemi;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.util.List;

import com.amazonaws.AmazonClientException;
import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.profile.ProfileCredentialsProvider;
import com.amazonaws.services.kinesis.AmazonKinesisClient;
import com.amazonaws.services.kinesis.model.PutRecordRequest;
import com.amazonaws.services.kinesis.model.PutRecordResult;
import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonNode;
import com.hemi.user.UserProfile;
import com.hemi.user.UserProfiles;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.amazonaws.services.kinesis.clientlibrary.exceptions.InvalidStateException;
import com.amazonaws.services.kinesis.clientlibrary.exceptions.ShutdownException;
import com.amazonaws.services.kinesis.clientlibrary.exceptions.ThrottlingException;

import com.amazonaws.services.kinesis.clientlibrary.interfaces.IRecordProcessor;
import com.amazonaws.services.kinesis.clientlibrary.interfaces.IRecordProcessorCheckpointer;
import com.amazonaws.services.kinesis.clientlibrary.lib.worker.ShutdownReason;
import com.amazonaws.services.kinesis.model.Record;

import static com.hemi.EMAAgent.AGENT_NAME;
import static com.hemi.EMAAgent.STREAM_NAME;

public class EMAAgentRecordProcessor implements IRecordProcessor {
    private static final Log LOG = LogFactory.getLog(EMAAgentRecordProcessor.class);
    private static final String IS_FREQUENT_VISITOR_TAG = "isFrequentVisitor";

    private String kinesisShardId;

    private static AmazonKinesisClient addEventKinesisClient;

    // Backoff and retry settings
    private static final long BACKOFF_TIME_IN_MILLIS = 3000L;
    private static final int NUM_RETRIES = 10;

    // Checkpoint about once a minute
    private static final long CHECKPOINT_INTERVAL_MILLIS = 60000L;
    private long nextCheckpointTimeInMillis;

    private final CharsetDecoder decoder = Charset.forName("UTF-8").newDecoder();
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * {@inheritDoc}
     */
    @Override
    public void initialize(String s) {
        LOG.info("Initializing record processor for shard: " + s);
        this.kinesisShardId = s;

        AWSCredentials credentials = null;
        try {
            credentials = new ProfileCredentialsProvider().getCredentials();
        } catch (Exception e) {
            throw new AmazonClientException(
                    "Cannot load the credentials from the credential profiles file. " +
                            "Please make sure that your credentials file is at the correct " +
                            "location (~/.aws/credentials), and is in valid format.",
                    e);
        }

        addEventKinesisClient = new AmazonKinesisClient(credentials);
        addEventKinesisClient.withEndpoint("https://kinesis.us-east-2.amazonaws.com");
    }

    public void processRecords(List<Record> list, IRecordProcessorCheckpointer iRecordProcessorCheckpointer) {
//        LOG.info("Processing " + list.size() + " records from " + kinesisShardId);

        // Process records and perform all exception handling.
        processRecordsWithRetries(list);

        // Checkpoint once every checkpoint interval.
        if (System.currentTimeMillis() > nextCheckpointTimeInMillis) {
            checkpoint(iRecordProcessorCheckpointer);
            nextCheckpointTimeInMillis = System.currentTimeMillis() + CHECKPOINT_INTERVAL_MILLIS;
        }
    }

    /**
     * Process records performing retries as needed. Skip "poison pill" records.
     *
     * @param records Data records to be processed.
     */
    private void processRecordsWithRetries(List<Record> records) {
        for (Record record : records) {
            boolean processedSuccessfully = false;
            for (int i = 0; i < NUM_RETRIES; i++) {
                try {
                    //
                    // Logic to process record goes here.
                    //
                    processSingleRecord(record);

                    processedSuccessfully = true;
                    break;
                } catch (Throwable t) {
                    LOG.warn("Caught throwable while processing record " + record, t);
                }

                // backoff if we encounter an exception.
                try {
                    Thread.sleep(BACKOFF_TIME_IN_MILLIS);
                } catch (InterruptedException e) {
                    LOG.debug("Interrupted sleep", e);
                }
            }

            if (!processedSuccessfully) {
                LOG.error("Couldn't process record " + record + ". Skipping the record.");
            }
        }
    }

    /**
     * Process a single record.
     *
     * @param record The record to be processed.
     */
    private void processSingleRecord(Record record) {
        String data = null;

        ObjectNode root = null;
        JsonNode eventNameNode = null;
        JsonNode userSessionIdNode = null;
        JsonNode userIdNode = null;

        String userSessionId = null;
        String userId = null;
        UserProfile userProfile = null;
        try {
            // For this app, we interpret the payload as UTF-8 chars.
            data = decoder.decode(record.getData()).toString();
            LOG.info(record.getSequenceNumber() + ", " + record.getPartitionKey() + ", " + data);

            root = (ObjectNode) mapper.readTree(data);
            eventNameNode = root.get("eventName");

            if (eventNameNode != null) {
                String eventName = eventNameNode.asText();
                if (eventName.equals("userSessionBecomesActive") || eventName.equals("userVisitsStore")) {
                    LOG.info("Processing eventName " + eventName);

                    // Put processing logic here:
                    userSessionIdNode = root.get("userSessionId");
                    userIdNode = root.get("userId");

                    if (userSessionIdNode != null) {
                        userSessionId = userSessionIdNode.asText();
                        if (userSessionId.equals("")) {
                            userSessionId = null;
                        }
                    }

                    if (userIdNode != null) {
                        userId = userIdNode.asText();
                        if (userId.equals("")) {
                            userId = null;
                        }
                    }

                    userProfile = UserProfiles.recordUserVisit(userSessionId, userId);
                    if (userProfile.isFrequentVisitor()) {
                        // put user tagging event into the stream
                        LOG.info("Spotted frequent visitor: " + userId + ", " + userSessionId);
                        addFrequentVisitorTagEvent(userSessionId, userId);
                    }
                } else {
                    LOG.info("Ignoring eventName " + eventName);
                }
            }
        } catch (CharacterCodingException e) {
            LOG.error("Malformed data: " + data, e);
        } catch (IOException e) {
            LOG.error("Invalid JSON: " + data, e);
        }
    }

    public void shutdown(IRecordProcessorCheckpointer iRecordProcessorCheckpointer, ShutdownReason shutdownReason) {
        LOG.info("Shutting down record processor for shard: " + kinesisShardId);
        // Important to checkpoint after reaching end of shard, so we can start processing data from child shards.
        if (shutdownReason == ShutdownReason.TERMINATE) {
            checkpoint(iRecordProcessorCheckpointer);
        }
    }

    /** Checkpoint with retries.
     * @param checkpointer
     */
    private void checkpoint(IRecordProcessorCheckpointer checkpointer) {
        LOG.info("Checkpointing shard " + kinesisShardId);
        for (int i = 0; i < NUM_RETRIES; i++) {
            try {
                checkpointer.checkpoint();
                break;
            } catch (ShutdownException se) {
                // Ignore checkpoint if the processor instance has been shutdown (fail over).
                LOG.info("Caught shutdown exception, skipping checkpoint.", se);
                break;
            } catch (ThrottlingException e) {
                // Backoff and re-attempt checkpoint upon transient failures
                if (i >= (NUM_RETRIES - 1)) {
                    LOG.error("Checkpoint failed after " + (i + 1) + "attempts.", e);
                    break;
                } else {
                    LOG.info("Transient issue when checkpointing - attempt " + (i + 1) + " of "
                            + NUM_RETRIES, e);
                }
            } catch (InvalidStateException e) {
                // This indicates an issue with the DynamoDB table (check for table, provisioned IOPS).
                LOG.error("Cannot save checkpoint to the DynamoDB table used by the Amazon Kinesis Client Library.", e);
                break;
            }
            try {
                Thread.sleep(BACKOFF_TIME_IN_MILLIS);
            } catch (InterruptedException e) {
                LOG.debug("Interrupted sleep", e);
            }
        }
    }

    private void addFrequentVisitorTagEvent (String userSessionId, String userId) {
        PutRecordRequest putRecordRequest = new PutRecordRequest();
        putRecordRequest.setStreamName(STREAM_NAME);
        putRecordRequest.setPartitionKey(userSessionId);

        JsonFactory jsonFactory = new JsonFactory();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] data = null;
        try {
            JsonGenerator jsonGenerator = jsonFactory.createGenerator(outputStream);
            jsonGenerator.writeStartObject();
            jsonGenerator.writeStringField("eventName", "userTag");
            jsonGenerator.writeStringField("eventSource", AGENT_NAME);
            if (userId != null) {
                jsonGenerator.writeStringField("userId", userId);
            }
            jsonGenerator.writeStringField("userSessionId", userSessionId);
            jsonGenerator.writeStringField("tag", IS_FREQUENT_VISITOR_TAG);
            jsonGenerator.writeEndObject();
            jsonGenerator.close();

            data = outputStream.toByteArray();
            outputStream.close();
        } catch (IOException e) {
            e.printStackTrace();
        }

        putRecordRequest.setData(ByteBuffer.wrap(data));

        PutRecordResult putRecordResult = addEventKinesisClient.putRecord(putRecordRequest);
        LOG.info("Successfully put event: " + new String(data, Charset.forName("UTF-8")));
    }

}
